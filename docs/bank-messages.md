# Mensajes del banco (SMS)

Registra solos los movimientos que el banco avisa por SMS: consumos, retiros en cajero y créditos. Usa el mismo mecanismo que Google Wallet (`docs/google-wallet.md`): leer **notificaciones**, sin permiso de SMS.

## Cómo se configura (en la app)

1. **Pagos automáticos → Mensajes del banco.** Lista de remitentes cuyos SMS se leen: el número que envía el SMS (`2424`) o la primera palabra del mensaje (`BiMovil`). Viene con los de Banco Industrial; el usuario puede agregar o quitar los de cualquier banco.
2. **Cuentas → editar → "Identificador en mensajes del banco".** Cómo nombra el banco a esa cuenta en sus SMS (`TCREDITO`, `BICHEQUE3`, `AHORRO`, o `****1234`). Se pueden poner varios separados por coma. Así el SMS sabe a qué cuenta pertenece.

Nada está fijo para un banco: el lector busca palabras de operación, montos y fechas comunes, y el usuario dice cómo se llaman sus cuentas.

## Privacidad

- **Sin permiso `READ_SMS`/`RECEIVE_SMS`.** Se lee la notificación que muestran Mensajes de Google, Samsung Mensajes o la app AOSP (`MESSAGING_PACKAGES`).
- El filtro corre en Kotlin (`BankSenderStore.matches`): un mensaje se encola solo si su remitente (título de la notificación) es uno de la lista o su texto empieza con uno. **Los demás mensajes se descartan en memoria y nunca se guardan.**
- La lista de remitentes vive en SharedPreferences privadas de la app (el listener la necesita aunque la app esté cerrada).
- Solo llegan los SMS cuya notificación se muestra después de activar el acceso. Los SMS viejos no se importan (eso sí requeriría el permiso de SMS).

## Qué entiende el lector (`parseBankMessage`)

Ejemplos reales de BiMovil (Banco Industrial):

| SMS | Tipo | Cuenta | Lugar | Fecha | Autorización |
|---|---|---|---|---|---|
| `Consumo por Q.28.25 en SUPER LA TORRE JOCOTEN Cuenta BICHEQUE3 24-Oct 13:29 Autorizacion 168554.` | gasto | BICHEQUE3 | SUPER LA TORRE JOCOTEN | 24 oct 13:29 | 168554 |
| `Credito por  Q. 80.00 Cuenta AHORRO en la Agencia DIGITAL  25-Oct 09:53 …` | ingreso | AHORRO | Agencia DIGITAL | 25 oct 09:53 | … |
| `Retiro por Q.100.00 en el Cajero A-AG JOCOTENANGO con su tarjeta BICHEQUE3 07-Nov 15:26 Aut.174582.` | retiro | BICHEQUE3 | Cajero A-AG JOCOTENANGO | 7 nov 15:26 | 174582 |
| `Debito por Q.100.00 Cuenta AHORRO en la Agencia CAJEROS AUTOMATICOS …` | gasto | AHORRO | Agencia CAJEROS AUTOMATICOS | … | 7349 |

- **Tipo:** la **primera** palabra de operación decide. Retiro → retiro; consumo, compra, cargo, débito, pago, cobro → gasto; crédito, depósito, abono, acreditamiento → ingreso. "Compra con tarjeta de crédito" es gasto.
- **Monto:** `Q.28.25`, `Q. 80.00`, `Q1,250.50`, `US$20.00`, `1.234,56 €`. Solo enteros en unidades menores.
- **Fecha:** la del mensaje (`24-Oct 13:29`, meses en español o inglés). El SMS no trae año: se usa el de llegada, o el anterior si quedaría en el futuro (compra del 31-Dic avisada el 1-Ene). Sin fecha, la hora de la notificación.
- **No son movimientos:** códigos, tokens, contraseñas, operaciones rechazadas o declinadas, y textos sin monto con moneda.

## Qué se registra

La cuenta se busca así (`resolveCaptureTarget`):
1. una sola tarjeta activa con los últimos 4 dígitos (Google Wallet, o `****1234` en el SMS);
2. si no, una sola cuenta activa cuyo identificador coincide con el nombre que usó el banco o aparece como palabra completa en el texto.

Si la cuenta tiene una sola tarjeta, el gasto se pone en esa tarjeta.

**Bandeja que se resuelve sola:** en cada sincronización (al abrir Inicio o Pagos automáticos) se reintentan las capturas de "Por registrar" (`registerWaitingCaptures`). Si después de recibir un SMS el usuario agrega el identificador a la cuenta (o la tarjeta), ese SMS se registra solo, sin tocar "Registrar".

| Tipo | Con cuenta (y misma moneda) | Sin cuenta |
|---|---|---|
| Gasto | Gasto "por revisar"; categoría sugerida por el último gasto en ese comercio | Bandeja "Por registrar" |
| Ingreso | Ingreso "por revisar" | Bandeja |
| Retiro | **Transferencia** de esa cuenta a la cuenta de **Efectivo** (sacar efectivo no es gastar). Si no hay exactamente una cuenta de efectivo en esa moneda, va a la bandeja. | Bandeja |

## Duplicados

- **El mismo SMS dos veces:** la referencia de la captura es `ref:<autorización>:<monto>`, única en `wallet_captures`.
- **Dos avisos del mismo hecho** (Google Wallet + SMS de la misma compra, o los dos SMS de un retiro en cajero, "Retiro … BICHEQUE3" y "Debito … AHORRO … CAJEROS AUTOMATICOS"): si ya hay un movimiento capturado con el mismo monto y moneda, de tipo compatible, a menos de 10 minutos (`SAME_MOVEMENT_WINDOW_MS`) y en la misma cuenta cuando se conoce, el aviso nuevo se enlaza a ese movimiento en lugar de crear otro. Si el segundo aviso llegó antes y quedó en la bandeja, se enlaza cuando se registra el primero.
- Riesgo aceptado: dos compras distintas del mismo monto, a menos de 10 minutos, donde una de ellas no tiene cuenta conocida, se tomarían como una. Se puede corregir registrando la otra a mano.

## Persistencia

Migración `0006_bank_messages.sql`:
- `accounts.bank_label` (texto, opcional). Validado por el dominio (`validateAccount`: partes de 2–30 letras, números, `*•#-`; máximo 80 caracteres).
- `wallet_captures.kind` (`expense` / `income` / `withdrawal`, con `CHECK`) y `wallet_captures.account_label`. La tabla se recrea; las capturas existentes quedan como `expense`.

**Respaldo:** `accounts.bankLabel` entra al archivo. Los respaldos con `schemaVersion` 4 y 5 se convierten explícitamente al restaurar (`bankLabel: null`), ver `docs/backup.md`.

## Archivos

| Capa | Archivo |
|---|---|
| Android | `wallet/WalletNotificationListener.kt` (mensajes de MessagingStyle uno por uno), `wallet/BankSenderStore.kt`, `WalletCapturesModule.kt` (`getBankSenders` / `setBankSenders`) |
| Puente | `src/core/native/walletCaptures.ts` |
| Dominio | `src/features/wallet/domain/parseBankMessage.ts`, `messageAmount.ts`; `src/features/accounts/domain/validateAccount.ts` (`parseBankLabels`) |
| Datos | `src/features/wallet/data/walletCaptureRepository.ts` (`importWalletNotifications`) |
| UI | `BankSendersCard` (Pagos automáticos), campo en `AccountForm`, fila en el detalle de la cuenta |

## Pruebas

- `__tests__/wallet/parseBankMessage.test.ts`: los SMS reales de BiMovil, otros formatos, fechas sin año, coincidencia de identificadores.
- `__tests__/db/bankMessageImport.test.ts`: registro por identificador, tarjeta única, SMS repetido, retiro como transferencia a efectivo, los dos SMS del cajero (en ambos órdenes), ingreso, Google Wallet + SMS de la misma compra, mensajes que no son movimientos.
