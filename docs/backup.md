# Respaldo y restauración (Backup V1)

Configuración → **Respaldo de datos**. Exporta todos los datos de la app a un archivo JSON y los restaura desde uno, sustituyendo los datos actuales. Solo Android en V1.

## Arquitectura

```
features/backup/
├── domain/
│   ├── types.ts               BackupFile, BackupData, ValidatedBackup, BackupSummary, constantes del formato
│   ├── backupFormat.ts        parseBackup (validación completa, sin I/O), serializeBackup, summarizeBackup, límites
│   ├── validateBackupData.ts  reglas entre filas (ids, referencias, índices únicos parciales, validadores de dominio)
│   └── backupErrors.ts        InvalidBackupError (con problemas tipados), BackupTooLargeError
├── data/backupRepository.ts   exportBackup (lectura en una transacción), restoreBackup (sustitución atómica)
├── hooks/useBackup.ts         exportToFile, readFromFile, restore: lo único que usa la pantalla
├── components/backupMessages.ts  textos para el usuario y resumen seguro para logs
└── screens/BackupScreen.tsx
core/native/
├── specs/NativeBackupFiles.ts spec de Codegen del módulo nativo
└── backupFiles.ts             saveTextDocument / openTextDocument tipados (FileTransferError)
android/app/src/main/java/com/controlgastos/backup/
├── BackupFilesModule.kt       Storage Access Framework
└── BackupFilesPackage.kt      registro en MainApplication
```

- El dominio no importa Drizzle. El formato usa las entidades de dominio (`Account`, `Card`, `Category`, `Transaction`, `Budget`, `SavingsGoal`), que son 1:1 con las columnas. La capa de datos reutiliza los mappers existentes (`rowTo*` / `*ToInsert`).
- La validación reutiliza los validadores de dominio (`validateAccount`, `validateCardFields`, `validateCategory`, `validateTransaction`, `validateBudget`, `validateSavingsGoal`): no se duplican reglas financieras.
- `restoreBackup` solo acepta un `ValidatedBackup`, un tipo que únicamente produce `parseBackup`.
- La pantalla no ejecuta SQL ni llama al módulo nativo: usa `useBackupActions`.

## Formato del archivo (versión 1)

```json
{
  "format": "control-gastos-backup",
  "formatVersion": 1,
  "schemaVersion": 4,
  "exportedAt": "2026-10-10T02:53:05.213Z",
  "data": {
    "accounts": [ { "id": "…", "name": "…", "type": "bank", "currency": "GTQ", "initialBalanceMinor": 500000, "createdAt": "…", "updatedAt": "…", "deletedAt": null } ],
    "categories": [ … ],
    "cards": [ … ],
    "transactions": [ … ],
    "budgets": [ … ],
    "savingsGoals": [ … ]
  }
}
```

| Clave | Contrato |
|---|---|
| `format` | Siempre `"control-gastos-backup"` |
| `formatVersion` | `1`. Cualquier otro valor se rechaza. |
| `schemaVersion` | Índice de la última migración aplicada (`max(idx)` de `schema_migrations`). Restaurar exige el mismo valor que la base actual. |
| `exportedAt` | Instante UTC ISO (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `data` | Exactamente las 6 colecciones. Cada fila tiene exactamente los campos de su entidad de dominio (camelCase), con los valores tal como están en SQLite. |

- Incluye **todas** las filas, también las archivadas (`deletedAt` distinto de `null`).
- Dinero: enteros en unidades menores (`amountMinor`, `initialBalanceMinor`, `targetAmountMinor`), nunca decimales.
- No incluye `schema_migrations`, datos del dispositivo ni secretos.
- JSON compacto en UTF-8. Nombre sugerido: `control-gastos-AAAA-MM-DD.json` (fecha civil del dispositivo).
- Agregar un campo a una entidad de dominio no compila hasta actualizar las reglas de `backupFormat.ts` (tipado exhaustivo). Ese cambio exige revisar `formatVersion`.

## Exportar

1. «Exportar respaldo» lee las 6 tablas **dentro de una transacción**: el respaldo es una instantánea coherente. No escribe nada.
2. Serializa a JSON. Si supera el máximo de 25 MB, no se exporta (así todo archivo exportado se puede restaurar).
3. El selector del sistema pide dónde guardarlo. Cancelar muestra «Exportación cancelada.».

## Restaurar

1. «Restaurar respaldo» abre el selector del sistema y lee el archivo (máximo 25 MB, UTF-8 estricto).
2. `parseBackup` lo valida por completo **sin tocar la base** (ver abajo).
3. La pantalla muestra un resumen (fecha y cantidad de registros por colección, archivados aparte) y advierte que se sustituirán todos los datos.
4. «Sustituir mis datos» pide una confirmación final («¿Sustituir todos tus datos?»). Cancelar en cualquier paso no cambia nada.
5. `restoreBackup`, en **una sola** `database.withTransaction`:
   - comprueba de nuevo `schemaVersion`;
   - borra `savings_goals`, `budgets`, `transactions`, `cards`, `categories` y `accounts` (hijos antes que padres);
   - inserta `accounts`, `categories`, `cards`, `transactions`, `budgets` y `savings_goals` (padres antes que hijos), en lotes de ≤ 900 parámetros;
   - ejecuta `PRAGMA foreign_key_check`.

   Las FK y los `CHECK` están activos durante todo el proceso: SQLite es la segunda barrera. Cualquier error provoca `ROLLBACK` y los datos actuales quedan intactos. El éxito se informa solo después del `COMMIT`.
6. «Ir al inicio» vuelve a las pestañas. Todas las pantallas recargan desde SQLite al recuperar el foco (`useReloadOnFocus`), sin reiniciar la app.

Restaurar es la única operación que borra filas físicamente. Siempre ocurre dentro de la transacción, después de validar y de la confirmación explícita.

## Validación (antes de escribir)

| Comprobación | Problema |
|---|---|
| Archivo vacío | `empty` |
| Más de 25 MB (UTF-8) | `too_large` (también lo rechaza Kotlin al leer) |
| Anidamiento mayor que 4 niveles, medido antes de `JSON.parse` | `too_deep` |
| JSON inválido | `not_json` |
| `format` distinto | `unknown_format` |
| `formatVersion` distinto | `unsupported_version` |
| `schemaVersion` distinto del de la base | `schema_mismatch` |
| Claves de primer nivel o colecciones faltantes o extra | `invalid_structure` |
| Campo faltante, extra o con tipo o valor inválido: UUID v4, instantes ISO, fechas civiles reales, moneda `AAA`, enumeraciones del dominio, iconos de categoría, `last4`, enteros seguros (> 0 donde el schema lo exige) | `invalid_field` |
| Id repetido en una colección | `duplicate_id` |
| Referencia a una fila que no está en el respaldo (cuenta, cuenta destino, categoría, tarjeta, padre de tarjeta, presupuesto o meta) | `broken_reference` |
| Dos filas activas que violan un índice único parcial: categoría por tipo y nombre, presupuesto por categoría y moneda, meta por cuenta | `duplicate_active` |
| Reglas de dominio: moneda del movimiento igual a la de sus cuentas, transferencia sin categoría ni tarjeta, tarjeta de la cuenta, tipo de la categoría, presupuesto de categoría de gastos; tarjeta o meta activa en cuenta archivada; meta activa en `credit_card` | `rule_violation` |

- Las reglas se aplican como en una edición: el historial puede apuntar a cuentas, tarjetas o categorías archivadas.
- No se corrige, completa ni migra nada. Se informan hasta 20 problemas; la pantalla muestra el primero (colección, número de registro y campo, nunca valores) y cuántos más hay, siempre con «Tus datos actuales no cambiaron.».

## Contrato nativo (Kotlin ↔ TypeScript)

`TurboModuleRegistry.get('BackupFiles')`, generado por Codegen desde `src/core/native/specs` (`codegenConfig` en `mobile/package.json`). Se registra en `MainApplication.kt` con `BackupFilesPackage`.

| Método | Comportamiento |
|---|---|
| `createDocument(suggestedName, content): Promise<void>` | `ACTION_CREATE_DOCUMENT` (`application/json`). Escribe UTF-8 con `ContentResolver.openOutputStream(uri, "wt")` (con respaldo `"w"`) en un hilo de I/O. Si la escritura falla, intenta borrar el documento creado. |
| `openDocument(maxBytes): Promise<string>` | `ACTION_OPEN_DOCUMENT` (`application/json`, `text/plain`, `application/octet-stream`). Lee con `openInputStream(uri)` en un hilo de I/O, corta al superar `maxBytes` y decodifica UTF-8 estricto. |

- Sin permisos de almacenamiento: el selector concede acceso solo al documento elegido. No se asumen rutas de archivo.
- Rechazos (`code`): `E_CANCELLED`, `E_BUSY` (ya hay un selector abierto), `E_NO_ACTIVITY` (la app no está en primer plano), `E_UNAVAILABLE` (ninguna app atiende el selector), `E_WRITE_FAILED`, `E_READ_FAILED`, `E_TOO_LARGE`, `E_NOT_TEXT`.
- `core/native/backupFiles.ts` convierte la cancelación en un resultado (`'cancelled'`) y el resto en `FileTransferError` con un código tipado. Fuera de Android lanza `FileTransferError('unavailable')`.
- Los streams se cierran con `use`. `invalidate()` quita el listener, cancela un selector pendiente y apaga el hilo de I/O.

## Privacidad y logs

- **El archivo no está cifrado**: contiene todos los datos financieros. La pantalla lo advierte y el usuario debe guardarlo en un lugar seguro.
- Nunca se registra el contenido. Los errores de Drizzle incluyen los parámetros SQL (datos financieros), por eso la pantalla registra solo `backupErrorLogSummary(error)` (tipo y códigos), nunca el error completo.

## Testing

- `__tests__/backup/backupFormat.test.ts` (validación con un respaldo real de SQLite):
  - JSON vacío, corrupto, demasiado grande o demasiado profundo (sin llegar a parsearlo);
  - formato, versión y schema;
  - claves y campos faltantes, extra o con tipo incorrecto;
  - decimales y montos fuera de rango;
  - enumeraciones, fechas, UUID e iconos;
  - ids duplicados, referencias rotas, índices únicos parciales y reglas de dominio;
  - límite de 20 problemas, mensajes, texto Unicode y conteo de bytes.
- `__tests__/db/backupRepository.test.ts` (SQLite real):
  - exportación completa (con archivados y `pending`) y sin escrituras;
  - ida y vuelta idéntica en una base vacía y sustitución (sin fusionar) en una base con datos;
  - saldos, totales del mes, presupuestos y metas idénticos;
  - sin movimientos nuevos; repetir no duplica;
  - el índice parcial tras restaurar;
  - 5 007 movimientos;
  - **rollback** ante un error simulado de inserción (en `transactions` y en `savings_goals`), un índice único violado, una FK rota y otra versión de schema;
  - un archivo inválido nunca llega a la base.
- `__tests__/backup/backupScreen.test.tsx` (rutas reales, módulo nativo simulado):
  - entrada desde Configuración;
  - exportar: guardado, cancelado, fallo de escritura (el log no lleva contenido) y bloqueo de acciones mientras trabaja;
  - restaurar: resumen antes de escribir, ambas confirmaciones, cancelación en cada paso, archivos inválidos, errores de lectura y vuelta al Inicio con los datos restaurados.
- Emulador Android (manual): exportar (cancelar y guardar), archivo inválido, cancelar el selector, resumen, cancelar y confirmar la sustitución, Inicio y Cuentas con los datos restaurados, y nueva exportación idéntica a la original.

## Limitaciones V1

- Solo Android. En otras plataformas el selector no está disponible y se informa.
- Solo se restauran respaldos con el mismo `schemaVersion` que la base actual. Tras una migración futura, los respaldos anteriores necesitarán un convertidor explícito (no se migra en silencio).
- Máximo 25 MB por respaldo (del orden de 50 000 movimientos). El archivo completo se carga en memoria.
- Sustitución total: no hay fusión ni restauración parcial.
- Sin respaldo automático, nube ni cifrado. `android:allowBackup` sigue en `false`.
- JSON no distingue `100` de `100.0`: un entero escrito con decimales en cero se acepta como entero; cualquier parte decimal distinta de cero se rechaza.
- Si Android destruye la app mientras el selector está abierto (falta de memoria), la operación pendiente se pierde y hay que repetirla.
