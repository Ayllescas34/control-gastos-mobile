# Auditoría del proyecto y roadmap

Fecha: 2026-10-09. Base auditada: `develop` = `origin/develop` = `c586ac0` (merge del PR #10). `main` = `origin/main` = `6d42dfb`.

Este documento separa **hechos verificados** (con evidencia), **inferencias** (marcadas como tales) y **recomendaciones**. No sustituye a los documentos de cada módulo (`docs/*.md`).

## 1. Resumen ejecutivo

- La aplicación local está sana. Las validaciones de esta auditoría están en verde: 569 tests, TypeScript, ESLint, `db:check` y build Android de debug.
- Las reglas financieras están implementadas en código y protegidas en dos capas: dominio y `CHECK`/FK de SQLite. Hay una sola fórmula de saldo (`movementEffect`) y un solo agregado de gastos por categoría, compartido por Dashboard y Presupuestos.
- **No se encontró ningún defecto P0** (error de cálculo, corrupción o secreto expuesto).
- **Riesgo principal:** no hay forma de respaldar ni recuperar los datos.
  - `android:allowBackup="false"` (`mobile/android/app/src/main/AndroidManifest.xml:10`).
  - No existe exportación ni importación.
  - Desinstalar la app, perder el teléfono o cambiar de dispositivo implica perder todo el historial financiero.
- **Siguiente módulo recomendado:** Respaldo y restauración local (Backup V1). Es un archivo JSON versionado que se exporta e importa de forma atómica y no requiere migración.
- Antes de empezar hay que aprobar una decisión: el mecanismo nativo para guardar y abrir archivos (sección 12).

## 2. Estado real del repositorio

| Elemento | Estado verificado |
|---|---|
| Rama / working tree | `develop`, limpio, sincronizada con `origin/develop` |
| Últimos merges | PR #6 (cuentas) → #7 (categorías/movimientos) → #8 (dashboard) → #9 (presupuestos) → #10 (metas de ahorro) |
| `backend/` | **No existe** (correcto según CLAUDE.md) |
| `README.md` en la raíz | **No existe**, aunque CLAUDE.md lo incluye en la estructura. `mobile/README.md` es el de la plantilla de RN. |
| `docs/` | `accounts-management`, `budgets`, `categories-management`, `dashboard`, `domain-model`, `savings`, `transactions-management`, `ui-icons` |
| Código | `mobile/src`: 190 archivos, ~12.9k líneas TS/TSX sin contar migraciones |
| Tests | 31 suites, 569 tests, sin snapshots |
| Dependencias | 12 de runtime, versiones fijas salvo `react-native-safe-area-context ^5.5.2` |
| TypeScript | `strict: true` (heredado de `@react-native/typescript-config`). Sin `any`, `@ts-ignore` ni `eslint-disable` en `src`. |
| Carpetas reservadas vacías | `core/api`, `core/native`, `core/storage`, `shared/utils` (solo `.gitkeep`) |
| Archivos sensibles | No hay `.env` versionados. `android/app/debug.keystore` está versionado (es el de la plantilla de RN; inferencia: es la clave pública de depuración, no un secreto). `ios/.xcode.env` es de la plantilla. |

## 3. Inventario funcional

| Área | Estado real | Evidencia | Observaciones |
|---|---|---|---|
| Cuentas: crear, editar, archivar | Implementado | `features/accounts/data/accountRepository.ts`, `__tests__/db/accountRepository.test.ts` | La moneda no es editable. Archivar se bloquea si hay tarjetas o metas activas. |
| Tipos de cuenta | Implementado | `schema/accounts.ts:33` (CHECK), `validateAccount.ts` | El tipo es editable. A `credit_card` se bloquea si la cuenta tiene una meta activa (`accountRepository.ts:107-117`). |
| Saldo actual derivado | Implementado | `transactionRepository.ts:97-103` (`movementEffect`), `getAccountBalance`, `listAccountBalances` | Una sola expresión SQL, usada por Cuentas, Dashboard y Metas. |
| Tarjetas (alias, last4, red) | Implementado | `cardRepository.ts`, `schema/cards.ts` | No guarda PAN, CVV ni vencimiento. Sin fechas de corte ni de pago. |
| Movimientos: CRUD + archivar | Implementado | `transactionRepository.ts` (create/update/softDelete), `transactionsScreens.test.tsx` | Validación pura + contexto desde SQLite |
| Transferencias y pago de tarjeta | Implementado | CHECK `transactions_transfer_check`, `listDailyTotals` excluye transfer | Probado en `dashboardQueries.test.ts` y `transactionRepository.test.ts` |
| Búsqueda y filtros | Implementado | `transactionFilters.ts`, `list()` en SQL | Tipo, período (todo / mes / mes anterior / 30 días), cuenta, categoría y texto. Sin rango personalizado ni paginación. Ignora mayúsculas solo en ASCII. |
| Estado `pending` | Parcial | `domain-model.md:132`, `transactionFormModel.ts:217` | Cuenta en todos los cálculos, pero la UI siempre crea `confirmed` y la regla está marcada como **PENDIENTE**. |
| Categorías (12+2 por defecto, personalizadas, archivar) | Implementado | `0002_default_categories.sql`, `categoryRepository.ts`, `categories_kind_name_unique` | IDs fijos, útiles para una futura sincronización |
| Dashboard | Implementado (mes actual) | `useDashboard.ts`, `dashboardSummary.ts` | Saldo, ingresos, gastos, evolución diaria, categorías y recientes, por moneda |
| Presupuestos | Implementado (mes actual) | `budgetHooks.ts:47` reutiliza `listExpenseTotalsByCategory` | UI solo en GTQ. Sin historial. |
| Metas de ahorro | Implementado | `features/savings`, `0004_savings_goals.sql` | Saldo real de la cuenta. Sin aportes artificiales. |
| Pestaña Reportes | **Pendiente (placeholder)** | `features/reports/screens/ReportsScreen.tsx` | Pestaña visible en la navegación principal que solo muestra "próxima fase" |
| Respaldo / exportación / importación | **Pendiente** | No hay código; `allowBackup="false"` | Riesgo de pérdida total de datos |
| Movimientos recurrentes | Pendiente | — | — |
| Importación (CSV / notificaciones) | Pendiente | `source`/`externalRef` existen en el schema; falta `UNIQUE(source, external_ref)` | Bloqueado por 2 decisiones pendientes del dominio |
| Seguridad local (bloqueo, cifrado) | Pendiente | `op-sqlite` abierto sin `encryptionKey` (`client.ts`) | — |
| Persistencia y migraciones | Implementado | `core/db/migrate.ts` (atómica, `foreign_key_check`), `initDatabase.ts` (FK ON verificado, WAL) | Las migraciones 0000–0004 se prueban sobre instalaciones existentes |
| Design System e iconos | Implementado | `shared/theme`, `shared/icons`, regla ESLint `no-restricted-imports` | Una excepción literal: `MainTabs.tsx:99` (`fontSize: 11`) |
| Estado global | No existe (por decisión) | `useAsyncResource` + `useReloadOnFocus` | SQLite es la fuente de verdad |
| Backend / sincronización | No existe (por decisión) | Sin `backend/`; `core/api/.gitkeep` | La base es compatible (ver §4.3) |

## 4. Hallazgos y riesgos

### 4.1 Reglas de negocio: implementadas o solo documentadas

| Regla | Estado | Evidencia |
|---|---|---|
| Dinero como entero en unidades menores | Implementada (doble barrera) | `columns.ts:202` (`isSafeInteger`), `parseMoney` |
| GTQ por defecto, sin conversión | Implementada | `appConfig.ts`; `validateTransaction.ts:115-118` (`currency_mismatch`); el Dashboard agrupa por moneda |
| income / expense / transfer | Implementada | `transactions_type_check`, `transactions_transfer_check` |
| Transferencia no es gasto | Implementada | `listDailyTotals` y `listExpenseTotalsByCategory` filtran por tipo |
| Compra con tarjeta = gasto; pago = transfer sin duplicar | Implementada y probada | `movementEffect`; tests "pago de tarjeta sin gasto duplicado" |
| `pending` | **Solo documentada como pendiente.** El código la cuenta siempre, pero ningún flujo crea `pending`. | `domain-model.md:132` |
| Archivados no cuentan | Implementada | `notDeleted(...)` en todas las lecturas; no hay ningún `.delete(` físico en `src` |
| Presupuesto por categoría y moneda | Implementada | `budgets_category_currency_unique` (parcial) |
| Metas sobre el saldo real, sin registros ficticios | Implementada | `savingsHooks.ts:46`; no hay tablas ni columnas de aportes |
| Historial por borrado lógico | Implementada | FK `RESTRICT` en todas las relaciones |
| `UNIQUE(source, external_ref)` | **Pendiente** (prevista para la etapa de importación) | `domain-model.md:133`, `schema/transactions.ts:74` |

### 4.2 Hallazgos

Las prioridades se definen en §6. Defecto confirmado = verificado en el código. Sospecha = necesita medición o prueba.

| # | Tipo | Hallazgo | Evidencia | Impacto |
|---|---|---|---|---|
| H1 | **Riesgo confirmado (P1)** | No hay respaldo ni recuperación de datos | `AndroidManifest.xml:10` `allowBackup="false"`; Configuración solo tiene Cuentas, Categorías, Presupuestos y Metas; no hay código de export/import | Perder el dispositivo o desinstalar la app = perder todo el historial |
| H2 | Riesgo de UX/finanzas (P2) | Archivar una cuenta con saldo ≠ 0 la saca del saldo total sin avisarlo | `AccountDetailScreen.tsx:86-89` (el diálogo no menciona el saldo); `dashboard.md:55` (excluir archivadas es una decisión documentada) | El total del Inicio cambia "sin explicación" para el usuario |
| H3 | Defecto de UX (P2) | La pestaña principal "Reportes" está vacía | `ReportsScreen.tsx` | Una de las 4 pestañas no aporta nada |
| H4 | Sospecha de rendimiento (P2) | Movimientos carga todo el historial en cada foco: período por defecto `all`, sin `limit` ni paginación | `transactionFilters.ts:20-25`, `transactionRepository.list`; limitación documentada en `transactions-management.md` | Con miles de movimientos puede volverse lento. **No medido.** |
| H5 | Bloqueo de dominio (P2) | La semántica de `pending` y la unicidad de `source + external_ref` siguen sin decidir | `domain-model.md:132-133` | Bloquea cualquier importación automática |
| H6 | Sospecha de integridad (P3) | Validar y escribir no es atómico. Por ejemplo, `accountRepository.softDelete` cuenta tarjetas y metas y después actualiza. Para "cuenta archivada con meta activa" no existe una segunda barrera en SQLite. | `accountRepository.ts:123-146`, `savingsGoalRepository.create` | Solo alcanzable con operaciones concurrentes; con la UI actual de un solo usuario es improbable |
| H7 | Inferencia (P3) | Cambiar una cuenta de `credit_card` a otro tipo convierte implícitamente sus tarjetas de crédito en débito (regla 11) | `AccountForm.tsx:84-90`, `domain-model.md:62` | No afecta saldos; puede confundir el historial |
| H8 | Calidad (P3) | `fontSize: 11` literal en `MainTabs.tsx:99`; `DemoBadge` sin uso (`shared/components/DemoBadge.tsx`) | grep | Deuda menor del Design System y código muerto |
| H9 | Antes de publicar (P2) | La variante release se firma con la clave de debug y ProGuard está apagado | `android/app/build.gradle:60,98-104` | Bloquea una publicación real; no afecta al desarrollo |
| H10 | Documentación (P3) | Falta `README.md` en la raíz; `mobile/README.md` es el de la plantilla | `ls` | Onboarding/portafolio |
| H11 | Limitaciones conocidas | Presupuestos solo en GTQ en la UI; Dashboard y Presupuestos solo del mes actual; búsqueda sin acentos | `budgets.md`, `dashboard.md`, `transactions-management.md` | Documentadas |

### 4.3 Compatibilidad con un backend futuro

Hechos favorables:
- UUID v4 generados por la app (`core/db/ids.ts`).
- Instantes ISO UTC más `local_date` civil.
- `updated_at` y `deleted_at` en todas las tablas.
- IDs fijos de las categorías por defecto.
- El dominio no depende de Drizzle.
- Dinero como entero con moneda, que se traslada tal cual a PostgreSQL (`bigint`).

Faltante (no urgente): registro de cambios para sincronizar (versión o `sync_state`) e identificador de dispositivo. Recomendación: no agregarlos hasta que exista el backend, pero conservar UUID, timestamps y borrado lógico en todo módulo nuevo.

## 5. Validaciones ejecutadas en esta auditoría

| Comando | Resultado |
|---|---|
| `npx jest` (`npm test`) | 31 suites, **569/569** OK, 0 snapshots |
| `npx tsc --noEmit` | OK (exit 0) |
| `npm run lint` | OK (exit 0) |
| `npm run db:check` | "Everything's fine" |
| `android/gradlew.bat assembleDebug` | **BUILD SUCCESSFUL** (55 s). Las salidas van a carpetas ignoradas por Git; el working tree siguió limpio. |
| `npm run db:generate` | **No ejecutado:** escribiría archivos si hubiera diferencias, y `db:check` ya cubre la consistencia |
| Emulador / dispositivo | **No verificado** en esta auditoría |

## 6. Pendientes priorizados

Puntuación 1–5. En Esfuerzo, 5 es lo más costoso.

| Candidato | Valor | Integridad | Desbloquea | Urgencia | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|
| Respaldo y restauración local | 5 | 5 | 4 | 5 | 3 | **P1 (primero)** |
| Reportes por mes (reemplazar el placeholder) | 4 | 2 | 2 | 3 | 3 | P1 |
| Consolidación UX (aviso de saldo al archivar, paginación/límite, búsqueda sin acentos, deuda del DS) | 3 | 2 | 1 | 2 | 2 | P2 |
| Decisiones de dominio para importación (`pending`, `UNIQUE(source, external_ref)`) | 2 | 4 | 4 | 2 | 1 | P2 (antes de importar) |
| Importación de movimientos (CSV bancario) | 4 | 3 | 3 | 2 | 4 | P2 |
| Movimientos recurrentes | 4 | 2 | 1 | 2 | 4 | P2 |
| Tarjetas de crédito: fecha de corte y de pago | 3 | 3 | 1 | 2 | 3 | P2 |
| Seguridad local (bloqueo biométrico, cifrado SQLCipher) | 3 | 2 | 1 | 2 | 4 | P2 |
| Exportación CSV para hojas de cálculo | 3 | 1 | 1 | 1 | 2 | P3 |
| Preparación de sincronización | 2 | 3 | 4 | 1 | 3 | P3 |
| Backend NestJS + autenticación | 2 | 2 | 3 | 1 | 5 | P3 |
| Firma de release y ProGuard (H9) | 1 | 1 | 2 | 1 | 1 | P2, solo antes de publicar |

Por qué estas puntuaciones:
- **Respaldo:** es lo único que protege todos los datos ya capturados. Su urgencia crece con cada día de uso real. Además desbloquea la migración entre dispositivos y la semilla para una futura sincronización.
- **Reportes:** es el mayor valor visible y ya tiene un hueco en la navegación, pero no protege datos. Reutiliza las consultas existentes con un rango de fechas.
- **Importación y recurrentes:** tienen mucho valor, pero son más caros. La importación depende de decisiones de dominio aún abiertas.
- **Backend:** hoy no tiene justificación concreta (un solo usuario, local-first).

Defectos y módulos nuevos:
- **Sin P0.**
- H1 es un riesgo que se resuelve con un módulo nuevo.
- H2, H3, H4 y H8 son correcciones pequeñas que se pueden agrupar en una "consolidación".

## 7. Comparación de los candidatos al siguiente módulo

| | Respaldo V1 | Reportes V1 | Consolidación UX |
|---|---|---|---|
| Problema que resuelve | Pérdida total de datos | Sin historial más allá del mes actual | Fricciones y riesgos menores |
| Integridad financiera | Alta | Baja | Media |
| Dependencias nuevas | Una decisión de I/O de archivos (nativo o paquete) | Ninguna | Ninguna |
| Migración | No | No | No |
| Riesgo técnico | Medio (restauración atómica, formato versionado) | Bajo | Bajo |
| Qué se pierde si espera | Datos reales irrecuperables | Comodidad | Comodidad |

**Decisión:** Respaldo V1. Reportes V1 queda como el módulo siguiente.

## 8. Recomendación: Respaldo y restauración local (Backup V1)

1. **Problema:** todo el historial vive en un archivo SQLite del dispositivo sin copia posible (H1).
2. **Por qué ahora:** cada módulo nuevo agrega datos que el usuario no puede proteger. No requiere migración ni cambios en las reglas financieras. El formato JSON servirá luego como semilla de sincronización y como base de una exportación CSV.
3. **Incluye (V1):**
   - Configuración → "Respaldo de datos".
   - **Exportar**: un archivo `control-gastos-AAAA-MM-DD.json` con todas las tablas de negocio, incluidos los registros archivados.
   - **Restaurar**: elegir un archivo, validarlo, mostrar un resumen (conteos y fecha) y confirmar. Después se reemplazan todos los datos en una sola transacción.
   - Aviso de privacidad: el archivo contiene datos financieros sin cifrar.
4. **Fuera de alcance:**
   - respaldos automáticos o programados;
   - nube y Google Drive mediante API;
   - cifrado o contraseña;
   - fusionar datos (merge);
   - restaurar respaldos de otra versión de schema (V1 solo acepta la misma);
   - CSV;
   - importación bancaria;
   - implementación iOS de la capa de archivos (la interfaz queda lista);
   - `allowBackup` de Android.
5. **Dependencias:**
   - `core/db` (`withTransaction`, schema);
   - todas las tablas: `accounts`, `cards`, `categories`, `transactions`, `budgets`, `savings_goals`;
   - `features/settings` (entrada) y la navegación (una ruta).
6. **Capas y archivos previstos:**
   - `features/backup/data/backupFormat.ts`: tipos del archivo (`format`, `formatVersion`, `schemaVersion`, `exportedAt`, `data` por tabla) y su validación estructural. Vive en la capa de datos porque es un formato de persistencia: usa los tipos `$inferSelect`, y el dominio no importa Drizzle.
   - `features/backup/data/backupRepository.ts`: `exportSnapshot()` y `restoreSnapshot(file)`.
   - `features/backup/domain/backupErrors.ts`: `InvalidBackupError` (con códigos) y `UnsupportedBackupVersionError`.
   - `features/backup/domain/backupSummary.ts` (puro): conteos para la confirmación.
   - `core/storage/fileTransfer.ts`: interfaz `saveTextFile(name, content)` y `openTextFile()`, que devuelven `cancelled` cuando corresponde. La implementación Android depende de la decisión de §12.
   - `features/backup/hooks/useBackup.ts`, `features/backup/screens/BackupScreen.tsx`, `features/backup/index.ts`.
   - Modificaciones: `SettingsScreen.tsx` (un `ListItem`), `RootNavigator.tsx` y `navigation/types.ts` (ruta `Backup`), `CLAUDE.md` y `docs/backup.md`.
7. **Base de datos:**
   - Sin migración.
   - `schemaVersion` = el `idx` más alto de `schema_migrations`.
   - `schema_migrations` no se exporta.
8. **Reglas y riesgos:**
   - **Restauración atómica:** borrar en orden inverso a las FK (savings_goals, budgets, transactions, cards, categories, accounts) e insertar en orden directo, dentro de `database.withTransaction`. Ejecutar `PRAGMA foreign_key_check` antes del commit. Ante cualquier error, rollback y datos originales intactos.
   - Los `CHECK` y FK de SQLite son la segunda barrera. No se desactivan las FK.
   - Dinero: se exige `Number.isSafeInteger` antes de insertar; nunca se convierte.
   - Se conservan IDs, timestamps y `deleted_at` tal cual. No se crea ningún movimiento.
   - Los saldos, presupuestos y metas se derivan solos: deben quedar idénticos después de restaurar.
   - Rendimiento: inserciones por lotes dentro de la transacción; prueba con ≥ 5 000 movimientos.
   - Privacidad: no registrar contenidos en `console`; aviso explícito antes de exportar.
   - Archivos grandes: leerlos como texto completo es aceptable en V1. El límite está por definir en la implementación.
9. **Pruebas para darlo por terminado:** ver §11.
10. **Esfuerzo:** mediano.
11. **Antes de empezar:** aprobar la decisión de I/O de archivos (§12). No hay P0 que resolver antes.

## 9. Criterios de aceptación de Backup V1

1. Desde Configuración → Respaldo de datos se exporta un JSON con `format: "control-gastos-backup"`, `formatVersion: 1`, `schemaVersion` igual a la última migración y todas las filas de las 6 tablas, archivadas incluidas.
2. Exportar y restaurar en una base vacía produce filas idénticas, columna por columna.
3. Después de restaurar, `listAccountBalances`, los totales del Dashboard, el gasto de presupuestos y el progreso de metas coinciden con los de la base original.
4. Un archivo inválido (JSON roto, otro formato, otra versión, dinero no entero, FK rota, `CHECK` violado) se rechaza con un mensaje claro y **no modifica** los datos existentes.
5. Restaurar exige una confirmación que muestra los conteos y advierte que reemplaza todo. Cancelar no cambia nada.
6. Cancelar el selector de archivo no muestra error.
7. Hay estados de carga, error y reintento, y etiquetas de accesibilidad. Se usan los tokens del Design System.
8. Jest, tsc, lint, `db:check` y el build Android pasan. Exportar y restaurar se prueban manualmente en el emulador (pasos listados en el PR).

## 10. Roadmap

| Orden | Iniciativa | Grupo | Objetivo | Depende de | Tamaño | Terminada cuando |
|---|---|---|---|---|---|---|
| 1 | **Backup V1** | Consolidación local | Proteger los datos | Decisión de I/O | M | §9 cumplido |
| 2 | Consolidación UX | Consolidación local | H2 (aviso de saldo al archivar), H4 (límite/paginación medida), H8, búsqueda sin acentos | — | S | Hallazgos cerrados con tests |
| 3 | Reportes V1 | Producto | Pestaña Reportes: selector de mes, ingresos/gastos, gastos por categoría y presupuestos del mes elegido | Consultas por rango existentes | M | Placeholder eliminado; meses anteriores consultables |
| 4 | Movimientos recurrentes V1 | Producto | Plantillas que generan movimientos reales al confirmarlas (sin movimientos ficticios automáticos) | — | M/L | Reglas documentadas; sin duplicados |
| 5 | Tarjetas de crédito: corte y pago | Producto | Período de corte, fecha de pago y saldo del período | — | M | Tests de períodos |
| 6 | Decisiones de dominio para importar | Preparación arquitectónica | Decidir `pending` y agregar `UNIQUE(source, external_ref)` (migración) | — | S | `domain-model.md` sin PENDIENTES |
| 7 | Importación CSV V1 | Producto | Importar extractos con detección de duplicados | 6 | L | Reimportar no duplica |
| 8 | Seguridad local | Preparación arquitectónica | Bloqueo de la app y evaluación de SQLCipher | Aprobación de dependencias | M | Decisión documentada |
| 9 | Backend y sincronización | Futuro | NestJS + PostgreSQL + auth; sincronizar con UUID, `updated_at` y `deleted_at` | 1 (formato), 6 | L | Justificación concreta: multidispositivo |

Decisiones que conviene conservar desde ahora: UUID generados por la app, timestamps UTC, borrado lógico en toda tabla nueva, dinero entero con moneda, IDs fijos en datos semilla y el formato de backup versionado.

## 11. Plan de implementación para Claude Code (Backup V1)

- **Rama:** `feature/backup` desde `develop` (`c586ac0` o posterior). PR hacia `develop`.
- **Reglas que no se pueden romper:**
  - las de §4.1;
  - sin migración y sin tocar el schema;
  - sin cambios en las fórmulas de saldo, Dashboard, Presupuestos ni Metas;
  - no desactivar FK;
  - `withTransaction`, no `db.transaction()`;
  - el dominio no importa Drizzle;
  - iconos solo mediante `shared/icons`;
  - tokens del Design System.
- **Orden de implementación:**
  1. Leer `docs/domain-model.md`, `core/db/client.ts`, `migrate.ts` y los schemas.
  2. `backupFormat.ts` + `backupErrors.ts` + tests puros de validación de estructura, versión, dinero entero, tipos y campos faltantes.
  3. `backupRepository.exportSnapshot` + test con SQLite real (todas las tablas, archivados, orden estable).
  4. `restoreSnapshot` atómico, con tests de:
     - ida y vuelta idéntica;
     - saldos, presupuestos y metas iguales;
     - rollback ante FK rota, `CHECK` violado y versión distinta, con los datos originales intactos;
     - 5 000 movimientos;
     - restaurar sobre una base con datos.
  5. Interfaz `core/storage/fileTransfer.ts` + mock de Jest (`__mocks__` o inyección).
  6. Implementación Android según la decisión de §12, aislada en `core/native` (Kotlin) o en `core/storage` (paquete). Antes de tocar archivos nativos, explicar los cambios.
  7. `useBackup`, `BackupScreen`, entrada en Configuración y ruta. Tests de UI sobre rutas reales:
     - exportar: OK, cancelado y error;
     - restaurar: confirmar, cancelar, archivo inválido y error;
     - los datos cambian después de restaurar.
  8. `docs/backup.md`, `CLAUDE.md` (estado actual) y una referencia en `domain-model.md`.
- **Validación:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run db:check`, `npm run db:generate` (debe decir "No schema changes"), `cd android && gradlew assembleDebug`, y prueba manual en el emulador: exportar, desinstalar o limpiar, restaurar y comparar saldos.
- **Antes del PR:**
  - `git diff develop...HEAD --stat` sin archivos ajenos;
  - sin secretos ni artefactos generados;
  - sin JSON de respaldo con datos reales en el repo;
  - revisión de las dependencias agregadas, si se aprobaron.

## 12. Decisiones que requieren aprobación humana

1. **Mecanismo de archivos para Backup V1** (bloqueante):
   - **A. Recomendada.** Módulo nativo Kotlin mínimo con Storage Access Framework (`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`) en `core/native`. Sin dependencias de terceros, con una superficie de dos funciones. Exige cambios nativos explicados de antemano (registro del módulo; inferencia: interop de módulos con la New Architecture). iOS requerirá su equivalente más adelante.
   - **B.** Paquetes de la comunidad: selector de documentos + acceso a archivos (normalmente 2 dependencias). Es multiplataforma desde el inicio, pero agrega dependencias nativas y hay que verificar su compatibilidad con RN 0.87 y la New Architecture.
   - **C. Descartada como solución principal.** Activar `allowBackup` (Auto Backup de Android). Es opaca, no se puede probar, depende de la configuración de Google del usuario y el modo WAL exige cuidado.
2. **Formato:** JSON versionado (recomendado: portable, se puede validar y probar con `node:sqlite`, y sirve de semilla de sincronización) frente a una copia del archivo `.db` (`VACUUM INTO`): más simple de exportar, pero restaurar exige reemplazar el archivo abierto y no se puede validar.
3. **Semántica de `pending` y `UNIQUE(source, external_ref)`:** decidir antes de cualquier importación (roadmap, paso 6).
4. **Aviso al archivar una cuenta con saldo (H2):** solo avisar (recomendado) o bloquear mientras el saldo sea distinto de 0.
