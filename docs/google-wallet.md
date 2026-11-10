# Google Wallet

> Los SMS del banco usan el mismo mecanismo y la misma bandeja: ver `docs/bank-messages.md`. La pantalla ahora se llama **Pagos automáticos**.

Registra solos los pagos que haces con Google Wallet (tocar para pagar) y los deja en la app como movimientos.

## Por qué notificaciones

Google Wallet **no ofrece una API** para que otra app lea los pagos del usuario. La Google Wallet API sirve para que un emisor agregue pases (lealtad, boletos) a la billetera y requiere backend y cuenta de emisor; no da acceso a las transacciones.

Después de cada pago, Google Wallet muestra una notificación con el comercio, el monto y la tarjeta (`•••• 1234`). La app la lee con un `NotificationListenerService` de Android, con el permiso **Acceso a notificaciones** que el usuario concede en Ajustes del sistema.

- Solo Android. En iOS la pantalla muestra "Google Wallet no disponible".
- Solo se leen las notificaciones del paquete `com.google.android.apps.walletnfcrel`. Las demás se descartan sin inspeccionarlas.
- Nada sale del teléfono. No se guarda nada fuera de la cola nativa y SQLite.
- Solo se registran los pagos hechos **después** de conceder el acceso (Android no entrega notificaciones anteriores).

## Flujo

```
Pago con Google Wallet
   ↓ notificación
WalletNotificationListener (Kotlin)  → cola en SharedPreferences privadas (máx. 500)
   ↓ al abrir Inicio o Google Wallet
syncWalletNotifications (TS) → parseWalletNotification → importWalletNotifications (SQLite)
   ↓ solo después de guardar
acknowledge(ids) → se borran de la cola nativa
```

Si la app se cierra entre leer y guardar, la notificación sigue en la cola y se reintenta en la siguiente sincronización. Volver a leerla no la duplica (ver Deduplicación).

## Qué pasa con cada pago

`parseWalletNotification` (función pura) extrae el monto con su moneda, el comercio y los últimos 4 dígitos. Si no hay un monto con marca de moneda, o el texto habla de reembolso, devolución o pago rechazado, **no es un pago** y solo se confirma a la cola nativa.

| Situación | Resultado |
|---|---|
| Exactamente una tarjeta activa con esos 4 dígitos, y su cuenta usa la misma moneda | Se crea un **gasto** en esa cuenta y tarjeta, `source = 'notification'`, `status = 'pending'` ("Por revisar"), y la captura queda `registered`. La categoría se sugiere a partir del último gasto en el mismo comercio. |
| Ninguna tarjeta, varias tarjetas o moneda distinta | La captura queda `new` en **Por registrar** (pantalla Google Wallet). |

Monedas: `Q`/`GTQ` → GTQ, `US$`/`USD`/`$` → USD, `€`/`EUR` → EUR, `MX$`/`MXN` → MXN. Montos convertidos a unidades menores solo con operaciones de texto y enteros.

## Revisión

- **Por registrar** (`wallet_captures.status = 'new'`): "Registrar" abre el formulario de movimiento precargado (monto, comercio, fecha, cuenta y tarjeta si coinciden, categoría sugerida). Guardar crea el movimiento confirmado y enlaza la captura en una sola transacción (`registerWalletCapture`). "Descartar" la marca `dismissed` (para pagos ya registrados a mano).
- **Registrados automáticamente** (`transactions.status = 'pending'`): el detalle muestra "Por revisar" con el botón **Confirmar movimiento**. Editar y guardar también confirma.

## Decisiones de dominio

Cierran las dos decisiones pendientes de `docs/domain-model.md`:

- **`pending` sí afecta el saldo.** Un pago capturado ya salió de la cuenta; "por revisar" solo significa que falta revisar categoría y datos. Por eso saldos, Inicio, Presupuestos y Reportes siguen sin filtrar por `status`.
- **`UNIQUE(source, external_ref)`** cuando `external_ref` no es nulo (índice `transactions_source_external_ref_unique`, migración 0005). Incluye movimientos archivados: archivar un pago capturado no permite que se vuelva a registrar.

## Deduplicación

- El listener calcula un id estable: SHA-256 de paquete, hora del evento (`Notification.when`), título y texto. Una notificación actualizada por Wallet conserva el id.
- `wallet_captures.external_ref` es único; importar dos veces la misma notificación no hace nada.
- El movimiento automático guarda el mismo id en `transactions.external_ref`.

## Persistencia

Tabla `wallet_captures` (migración `0005_google_wallet.sql`): monto en unidades menores, moneda, comercio, `card_last4`, texto original, `posted_at`, `status` (`new` / `registered` / `dismissed`) y `transaction_id` (FK `RESTRICT`). `CHECK`: monto entero positivo, moneda `AAA`, `last4` de 4 dígitos, y `registered` si y solo si hay `transaction_id`.

**Respaldo:** `wallet_captures` es una bandeja local del dispositivo y **no** forma parte del archivo de respaldo. Restaurar la vacía antes de reemplazar los movimientos (la FK la obliga). Los movimientos capturados sí están en el respaldo, con su `external_ref`. La migración 0005 no cambió las seis tablas respaldadas, así que los respaldos con `schemaVersion` 4 se restauran sin cambios en una base 5 (`isRestorableSchemaVersion`).

## Archivos

| Capa | Archivo |
|---|---|
| Android | `android/app/src/main/java/com/controlgastos/wallet/` (`WalletNotificationListener`, `WalletCaptureStore`, `WalletCapturesModule`, `WalletCapturesPackage`), servicio en `AndroidManifest.xml`, registro en `MainApplication.kt` |
| Puente | `src/core/native/specs/NativeWalletCaptures.ts`, `src/core/native/walletCaptures.ts` |
| Dominio | `src/features/wallet/domain/parseWalletNotification.ts` |
| Datos | `src/features/wallet/data/walletCaptureRepository.ts`, `syncWallet.ts`, `src/core/db/schema/walletCaptures.ts` |
| UI | `WalletScreen` (Configuración → Google Wallet, y la tarjeta de Inicio), `RegisterWalletCaptureScreen`, banner "Por revisar" en el detalle del movimiento |

## Limitaciones

- El formato de la notificación lo decide Google y puede cambiar con versiones o idiomas. El parser es tolerante, pero un formato nuevo puede requerir ajustarlo; los pagos no reconocidos no se pierden en silencio solo si traen monto con moneda.
- Google Play revisa el uso de `NotificationListenerService`: antes de publicar hay que declarar el uso (finanzas personales) en la ficha.
- Sin verificación en un dispositivo real con Google Wallet todavía.

## Pruebas

- `__tests__/wallet/parseWalletNotification.test.ts`: formatos en español e inglés, monedas, separadores, notificaciones que no son pagos.
- `__tests__/db/walletCaptureRepository.test.ts`: registro automático, categoría sugerida, bandeja, deduplicación, moneda distinta, tarjetas ambiguas, registrar y descartar, índice único, restaurar un respaldo con capturas.
- `__tests__/wallet/walletScreens.test.tsx`: pantalla Google Wallet, formulario precargado, confirmar desde el detalle, Inicio como billetera.
