# Presupuestos

Un presupuesto es un **límite mensual de gasto, recurrente, para una categoría de gastos en una moneda**. Ejemplo: "Alimentación, Q2,000 al mes". Se administra en Configuración → **Presupuestos**.

Lo gastado nunca se guarda: se calcula en cada carga con los movimientos reales de SQLite.

## Arquitectura

```
BudgetsScreen / BudgetFormScreen (features/budgets/screens)
  ↓ hooks (useBudgetOverview, useBudgetFormData, useBudgetRepositories)
  ↓   buildBudgetOverview · evaluateBudget · sortBudgetProgress (domain, puras)
budgetRepository (CRUD)  ← validateBudget (domain)
transactionRepository.listExpenseTotalsByCategory (sumas en SQL, ya existente)
categoryRepository.list({ includeArchived: true })
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- Las pantallas no usan SQL. El dominio (`features/budgets/domain`) no importa Drizzle ni op-sqlite.
- `budgetRepository` solo hace CRUD. **Lo gastado sale de `listExpenseTotalsByCategory`**, la misma consulta del Dashboard: la regla de qué cuenta como gasto vive en un solo lugar.
- JavaScript no recibe movimientos: SQL devuelve una fila por categoría y moneda, y el dominio las cruza con los presupuestos usando solo enteros.

## Modelo

```ts
type Budget = Timestamps & {
  id: EntityId;
  categoryId: EntityId;   // categoría de gastos
  amountMinor: MinorUnits; // límite mensual, entero > 0
  currency: CurrencyCode;
};
```

Sin `period`, `startDate` ni `endDate`: el período es siempre el mes actual. Solo `amountMinor` se edita; categoría y moneda son inmutables (para cambiarlas se archiva y se crea otro).

Tipos derivados: `BudgetProgress` (`spentMinor`, `remainingMinor`, `status`), `UnbudgetedSpending` y `BudgetOverview` (`period`, `budgets`, `unbudgeted`).

## SQLite

Migración `0003_budgets` (generada con `npm run db:generate`). Tabla `budgets`:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | TEXT PK | UUID v4 de la app |
| `category_id` | TEXT NOT NULL | FK → `categories.id` ON DELETE RESTRICT |
| `amount_minor` | INTEGER NOT NULL | CHECK entero, `> 0`, `≤ 2^53 − 1` |
| `currency` | TEXT NOT NULL | CHECK `GLOB '[A-Z][A-Z][A-Z]'` |
| `created_at`, `updated_at`, `deleted_at` | TEXT | CHECK ISO UTC (helpers de `columns.ts`) |

- **Unicidad:** índice único parcial `budgets_category_currency_unique (category_id, currency) WHERE deleted_at IS NULL`. Un presupuesto activo por categoría y moneda; uno archivado no bloquea crear otro.
- "La categoría es de gastos" relaciona dos tablas: lo valida el dominio (el proyecto no usa triggers).
- Sin índice extra: el cálculo usa el índice parcial existente `transactions_category_id_local_date_idx`.

## Reglas (validateBudget)

| Caso | Error |
|---|---|
| Sin categoría elegida | `category_required` |
| La categoría no existe | `category_not_found` |
| Categoría de ingresos | `category_not_expense` |
| Categoría archivada (al crear) | `category_archived` |
| Monto ≤ 0, decimal o fuera de rango seguro | `amount_invalid` |
| Moneda inválida (misma regla que cuentas: `isCurrencyCode`) | `currency_invalid` |
| Ya hay un presupuesto activo para esa categoría y moneda | `budget_duplicate` |

El repositorio valida antes de escribir (`InvalidBudgetError`); `update` y `getById` devuelven `null` si el presupuesto fue archivado (`BudgetNotAvailableError` en la UI).

## Período

Mes civil actual del dispositivo: `monthRange(new Date())` (`shared/lib/dates`), recalculado en cada carga. El presupuesto es recurrente: aplica a todos los meses. Editar el monto cambia el límite también del mes en curso (no se guarda historial).

## Cálculo de lo gastado

Suma de `amount_minor` de movimientos con `type = 'expense'`, misma `category_id` y `currency` que el presupuesto, `local_date` dentro del mes y `deleted_at IS NULL`.

- No cuentan: ingresos, transferencias (incluido el **pago de tarjeta**) ni movimientos archivados.
- Sí cuentan: compras con tarjeta (son `expense`), movimientos `pending` y gastos de cuentas archivadas (igual que saldos y Dashboard).
- Gastos sin categoría nunca consumen presupuesto.

## Cálculos y estados (evaluateBudget)

- `remainingMinor = amountMinor − spentMinor` (negativo si se excede).
- Porcentaje = `spent / amount × 100`, **sin tope en 100** y solo para mostrar (Q1,250 de Q1,000 → 125%).
- Estados, comparados con enteros (`floor(amount / 5)` evita decimales y desbordes):

| Estado | Condición | Texto |
|---|---|---|
| `ok` | queda más del 20% | En orden |
| `warning` | queda 20% o menos y `spent < amount` | Por acercarse al límite |
| `reached` | `spent === amount` | Límite alcanzado |
| `exceeded` | `spent > amount` | Excedido por Q 250.00 |

Orden de la lista: `exceeded`, `warning`, `reached`, `ok`; dentro de cada estado, por nombre de categoría.

## Monedas

Cada presupuesto tiene su moneda y solo la consumen gastos de esa moneda; nunca se convierte ni se suman monedas distintas. Un gasto en USD de una categoría con presupuesto en GTQ aparece en "Sin presupuesto" (USD). La UI de V1 crea presupuestos solo en `appConfig.defaultCurrency` (GTQ): "Por ahora los presupuestos usan quetzales (GTQ)."

## Categorías archivadas

- No pueden recibir un presupuesto nuevo (no se ofrecen en el formulario).
- Archivarla **no** archiva su presupuesto (no hay cascada); el presupuesto sigue calculándose con los gastos que la usan y se marca "Categoría archivada". Se puede editar su monto o archivarlo.
- En "Sin presupuesto" aparece como "Categoría archivada", **sin** botón "Crear presupuesto".

## Sin presupuesto

Debajo de la lista: categorías con gasto en el mes y sin presupuesto activo para esa categoría y moneda (icono, nombre, gastado y moneda). Las categorías activas en GTQ ofrecen "Crear presupuesto" con la categoría preseleccionada. "Sin categoría" se muestra solo como información.

## UI

- **BudgetsScreen:** período ("Octubre 2026"), "Agregar presupuesto", lista (`BudgetListItem`: categoría, presupuesto, gastado, disponible, porcentaje, estado con icono y texto, `BudgetProgressBar`) y "Sin presupuesto". Estados: carga, error con "Reintentar", vacío ("Aún no tienes presupuestos" + "Crear presupuesto"). Recarga con `useReloadOnFocus`.
- **BudgetFormScreen:** al crear, categorías de gasto activas (`ChoiceGroup`; las que ya tienen presupuesto aparecen deshabilitadas), monto (`parseMoney`) y moneda fija. Al editar, categoría y moneda fijas, solo el monto, y "Archivar presupuesto" con confirmación ("Dejará de aparecer en tus presupuestos. Tus movimientos no cambian.").
- `ChoiceGroup` admite ahora `disabled` por opción (cambio compatible del Design System).

## Accesibilidad

- Cada presupuesto se anuncia como una frase: "Alimentación, gastado Q 1,250.00 de Q 2,000.00, 62.5 por ciento, disponible Q 750.00. En orden."
- `BudgetProgressBar`: `accessibilityRole="progressbar"`, `accessibilityValue` (`min 0`, `max 100`, `now` acotado a 100 y `text` con el porcentaje real).
- El estado nunca depende solo del color (icono + texto). Editar es un `IconButton` con etiqueta "Editar presupuesto de …" (48 dp). Errores del formulario con `accessibilityLiveRegion`.

## Testing

- `__tests__/budgets/budgetDomain.test.ts`: validaciones (monto, decimal, overflow, moneda, categoría inexistente/ingresos/archivada, duplicado, edición), estados y su umbral exacto, exceso sin tope, monedas, "Sin presupuesto", orden y formulario.
- `__tests__/db/budgetRepository.test.ts` (SQLite real): CRUD, CHECK, FK y RESTRICT, índice único parcial, recrear tras archivar, soft delete, cálculo de lo gastado (ingresos, transferencias, pago y compra con tarjeta, archivados, otros meses, otra moneda, `pending`, categoría y cuenta archivadas), migración `0003` sobre una instalación existente y persistencia entre conexiones.
- `__tests__/budgets/budgetsScreens.test.tsx` (rutas reales): navegación desde Configuración, carga, error, vacío, lista, exceso y orden, validación, creación, duplicado, edición, archivado y cancelación, "Sin presupuesto", categoría archivada y recarga al volver.

## Limitaciones V1

- Solo mensual y solo el mes actual; sin navegación entre meses ni historial de montos.
- La UI crea presupuestos solo en GTQ (el modelo soporta otras monedas).
- Sin presupuesto global ni para gastos sin categoría.
- Sin integración con el Dashboard (feature posterior).
