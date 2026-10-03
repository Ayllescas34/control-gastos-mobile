# Metas de ahorro

Una meta de ahorro significa **"quiero tener X dinero acumulado en esta cuenta"**. Ejemplo: cuenta "Ahorros" con Q4,500 y meta "Laptop" de Q10,000 → Q4,500 / Q10,000, 45%. Se administra en Configuración → **Metas de ahorro**.

La meta **no representa dinero adicional**: lo ahorrado es siempre el **saldo real de su cuenta**, calculado con las mismas reglas de saldo existentes. No se guarda ningún monto ahorrado, no se registran aportaciones en otra tabla y nunca se crea una transacción para la meta.

## Arquitectura

```
SavingsGoalsScreen / SavingsGoalFormScreen (features/savings/screens)
  ↓ hooks (useSavingsOverview, useSavingsGoalFormData, useSavingsRepositories)
  ↓   buildSavingsOverview · evaluateSavingsGoal · sortSavingsGoals (domain, puras)
savingsGoalRepository (CRUD)  ← validateSavingsGoal (domain)
transactionRepository.listAccountBalances (saldos en SQL, ya existente)
accountRepository.list({ includeArchived: true })
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- Las pantallas no usan SQL. El dominio (`features/savings/domain`) no importa Drizzle ni op-sqlite.
- **Lo ahorrado sale de `listAccountBalances()`**: una sola consulta para todos los saldos, la misma que usa Cuentas. No hay un cálculo paralelo del saldo ni consultas por meta o por movimiento.

## Modelo

```ts
type SavingsGoal = Timestamps & {
  id: EntityId;
  accountId: EntityId;            // cuenta cuyo saldo es lo ahorrado (fija)
  name: string;                   // requerido, trim, máx. 60
  targetAmountMinor: MinorUnits;  // entero > 0, en la moneda de la cuenta
  targetDate: LocalDate | null;   // opcional, solo informativa
};
```

**No se guardan** `savedAmountMinor`, `currency` ni `status`: los tres se derivan (saldo, moneda de la cuenta y comparación).

Tipos derivados: `SavingsGoalProgress` (`currency`, `savedMinor`, `remainingMinor`, `status`) y `SavingsOverview` (`goals`).

## Relación con Account

```
Account 1 ──── 0..1 SavingsGoal activa   savingsGoal.accountId
```

- Una meta tiene exactamente una cuenta, elegida al crear y **no editable** (para otra cuenta se archiva la meta y se crea otra).
- Una cuenta tiene **como máximo una meta activa**. Limitación de V1: quien quiera varias metas necesita una cuenta por meta.
- Cuentas permitidas: `savings`, `bank`, `cash` y `other`. **No `credit_card`**: su saldo es deuda, no ahorro.
- La cuenta debe estar activa al crear.
- **Una cuenta con meta activa no se puede archivar** (`AccountHasActiveSavingsGoalError`, mismo patrón que `AccountHasActiveCardsError`). Primero se archiva la meta. Así una meta activa nunca mide una cuenta oculta (las cuentas archivadas no aparecen en `listAccountBalances`).

## SQLite

Migración `0004_savings_goals` (generada con `npm run db:generate`). Tabla `savings_goals`:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT PK | UUID v4 de la app |
| `account_id` | TEXT NOT NULL | FK → `accounts.id` ON DELETE RESTRICT |
| `name` | TEXT NOT NULL | CHECK `length(trim(name)) > 0` |
| `target_amount_minor` | INTEGER NOT NULL | CHECK entero, `> 0`, `≤ 2^53 − 1` |
| `target_date` | TEXT | CHECK `NULL` o `YYYY-MM-DD` |
| `created_at`, `updated_at`, `deleted_at` | TEXT | CHECK ISO UTC (helpers de `columns.ts`) |

- **Unicidad:** índice único parcial `savings_goals_account_unique (account_id) WHERE deleted_at IS NULL`. Una meta archivada no bloquea crear otra en la misma cuenta.
- **Sin unicidad de nombre:** dos metas pueden llamarse igual si están en cuentas distintas.
- "La cuenta está activa y no es de crédito" relaciona dos tablas: lo valida el dominio (el proyecto no usa triggers).

## Reglas (validateSavingsGoal)

| Caso | Error |
|---|---|
| Nombre vacío o solo espacios | `name_required` |
| Nombre de más de 60 caracteres (tras trim) | `name_too_long` |
| Objetivo ≤ 0, decimal o fuera de rango seguro | `target_invalid` |
| Fecha que no es un día real `YYYY-MM-DD` (`isValidLocalDate`) | `target_date_invalid` |
| Sin cuenta elegida | `account_required` |
| La cuenta no existe | `account_not_found` |
| Cuenta archivada (al crear) | `account_archived` |
| Cuenta `credit_card` (al crear) | `account_type_invalid` |
| La cuenta ya tiene otra meta activa | `account_has_goal` |

Al editar: se pueden cambiar nombre, objetivo y fecha; la cuenta no (`SavingsGoalChanges` no la incluye); la meta no es duplicado de sí misma. Una meta archivada no se edita (`update` devuelve `null`; `SavingsGoalNotAvailableError` en la UI). El repositorio valida antes de escribir (`InvalidSavingsGoalError`).

## Cómo se ahorra y se retira

Con los movimientos que ya existen; la meta cambia porque cambia el saldo:

| Operación | Movimiento | Efecto en la meta | Gasto / ingreso | Presupuestos |
|---|---|---|---|---|
| Aportar: Monetaria → Ahorros | `transfer` | sube | no es ninguno | no consume |
| Retirar: Ahorros → Monetaria | `transfer` | baja | no es ninguno | no consume |
| Ingreso directo a Ahorros | `income` | sube | ingreso | no aplica |
| Gasto pagado desde Ahorros | `expense` | baja | gasto | sí consume su categoría |

Las transferencias exigen la misma moneda en ambas cuentas, así que el saldo de la cuenta nunca mezcla monedas.

## Saldo (lo ahorrado)

`savedMinor` = saldo derivado de la cuenta, exactamente como en Cuentas:

saldo inicial + ingresos + transferencias entrantes − gastos − transferencias salientes

- Incluye el **saldo inicial**: si la cuenta ya tenía dinero al crear la meta, la meta arranca con ese avance.
- Incluye movimientos `pending` y excluye los archivados (mismas reglas que los saldos).
- Puede ser negativo (sobregiro): se conserva en el dominio y se muestra 0%.

## Cálculos y estados (evaluateSavingsGoal)

- `remainingMinor = targetAmountMinor − savedMinor` (negativo cuando se supera).
- Estado derivado, comparado con enteros:

| Estado | Condición | Texto |
|---|---|---|
| `in_progress` | `saved < target` | En progreso |
| `reached` | `saved ≥ target` | Meta alcanzada / Meta superada por Q 2,500.00 |

- Porcentaje = `saved / target × 100`, **solo presentación**: sin tope (Q12,500 de Q10,000 → 125%) y con mínimo 0% si el saldo es negativo. La barra se llena hasta 100%, pero el texto y la accesibilidad muestran el valor real.
- Orden: en progreso antes que alcanzadas; dentro de cada estado, la fecha objetivo más cercana primero (sin fecha al final) y luego por nombre.

## Fecha objetivo

Opcional y **solo informativa**. Una fecha pasada sigue siendo válida y no cambia el estado: solo se muestra "Fecha objetivo: 15 dic 2026 (pasada)". Sin alertas, notificaciones ni recordatorios.

## Monedas

La moneda de la meta es la de su cuenta (no se guarda; la moneda de una cuenta no se puede editar). Una meta en GTQ necesita una cuenta en GTQ y una en USD, una cuenta en USD. Nunca se convierte.

## Completar y archivar

No hay `completed_at`. **Completar una meta es archivarla**: "Archivar meta" pide confirmación ("¿Ya cumpliste esta meta?" · "Archivarla la quitará de tu lista de metas activas. Tu cuenta, su saldo y tus movimientos no cambian."). No se guarda una copia del saldo. Archivar es `UPDATE deleted_at`; nada se borra físicamente.

## UI

- **SavingsGoalsScreen:** "Metas de ahorro" con "Agregar meta" y la lista (`SavingsGoalListItem`: nombre, "Q4,500 / Q10,000", porcentaje, `SavingsProgressBar`, "Cuenta: Ahorros", fecha objetivo y estado con icono y texto). Estados: carga, error con "Reintentar", vacío ("Aún no tienes metas de ahorro" + "Crear meta"). Recarga con `useReloadOnFocus` (por ejemplo, al volver después de una transferencia).
- **SavingsGoalFormScreen:** al crear, nombre, cuenta (`ChoiceGroup` sin cuentas de crédito ni archivadas; las que ya tienen meta aparecen deshabilitadas), monto objetivo (`parseMoney` en la moneda de la cuenta) y fecha opcional (AAAA-MM-DD). Al editar, la cuenta queda bloqueada y se agrega "Archivar meta". Sin cuentas utilizables, ofrece "Crear cuenta".
- La barra de progreso vive en Savings (`SavingsProgressBar`); no se hicieron refactors globales.

## Accesibilidad

- Cada meta se anuncia como una frase: "Laptop, Q 4,500.00 de Q 10,000.00, 45 por ciento, en progreso, cuenta Ahorros. Fecha objetivo: 15 dic 2026."
- `SavingsProgressBar`: `accessibilityRole="progressbar"`, `accessibilityValue` (`min 0`, `max 100`, `now` acotado a 100 y `text` con el porcentaje real).
- El estado nunca depende solo del color. Editar es un `IconButton` "Editar meta …" (48 dp). Errores del formulario con `accessibilityLiveRegion`.

## Testing

- `__tests__/savings/savingsDomain.test.ts`: validaciones (nombre, 60 caracteres, objetivo, `MAX_SAFE_INTEGER`, fechas inválidas y pasadas, cuenta inexistente/archivada/`credit_card`, cuenta con meta, edición de sí misma, mismo nombre en otra cuenta), progreso 0/parcial/alcanzado/superado, saldo negativo, monedas, fecha pasada, orden y formulario.
- `__tests__/db/savingsGoalRepository.test.ts` (SQLite real): CRUD, CHECK de nombre/objetivo/fecha, FK y RESTRICT, índice único parcial, recrear tras archivar, saldo inicial, ingreso, gasto, transferencia de entrada y salida, archivados, `pending`, meta alcanzada y superada, monedas, bloqueo de archivar la cuenta, migración `0004` sobre una instalación existente y persistencia entre conexiones.
- `__tests__/db/accountRepository.test.ts`: la nueva regla de archivado de cuentas.
- `__tests__/savings/savingsScreens.test.tsx` (rutas reales): navegación desde Configuración, carga, error y reintento, vacío, lista y frase accesible, barra, alcanzada, superada, fecha pasada, validación, creación, cuenta con meta deshabilitada y duplicado creado mientras tanto, sin cuentas utilizables, edición, archivado y cancelación, mensaje al archivar una cuenta con meta y recarga al volver tras una transferencia.

## Limitaciones V1

- Una meta activa por cuenta; sin repartir el saldo de una cuenta entre varias metas.
- El avance es el saldo completo de la cuenta (incluido lo que ya tenía al crear la meta).
- Si se retira el dinero tras cumplir la meta, el avance baja: se espera archivar la meta al cumplirla.
- Si una cuenta con meta cambia su tipo a `credit_card` en Cuentas, la meta se conserva (la regla de tipo se valida solo al crear).
- Sin historial, alertas, notificaciones ni integración con el Dashboard o Presupuestos.
