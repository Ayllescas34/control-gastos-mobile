# Dashboard (Inicio)

Resumen financiero real del mes actual, calculado exclusivamente con los datos persistidos en SQLite. No hay datos de demostración ni se crean datos automáticamente.

## Arquitectura

```
DashboardScreen (features/dashboard/screens)
  ↓ useDashboard (features/dashboard/hooks)
  ↓   summarizeByCurrency (features/dashboard/domain, función pura)
transactionRepository · accountRepository · categoryRepository
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- La pantalla no ejecuta SQL, no conoce tablas ni hace cálculos financieros: solo pinta lo que entrega `useDashboard`.
- No existe un `dashboardRepository`. Las consultas agregadas pertenecen a la tabla `transactions`, así que viven en `transactionRepository` junto a la expresión de saldos que ya existía.
- `useDashboard` reutiliza `useTransactionRepositories` y `loadReferences` de la feature de movimientos (importados por módulo, no por `index`, para evitar ciclos).
- Componentes: `SummaryCards`, `EvolutionChart`, `CategoryBreakdown` y `dashboardPresentation` (formato de porcentaje, nombre del mes y categoría). Movimientos recientes usa `TransactionListItem`.

## Fuente de datos

Una carga hace, en paralelo:

| Dato | Método | SQL |
|---|---|---|
| Cuentas activas | `accounts.list()` | `WHERE deleted_at IS NULL` |
| Saldos | `transactions.listAccountBalances()` (existente) | una consulta con `GROUP BY` |
| Ingresos/gastos por día | `transactions.listDailyTotals(range)` (nuevo) | `SUM … GROUP BY local_date, type, currency` |
| Gastos por categoría | `transactions.listExpenseTotalsByCategory(range)` (nuevo) | `SUM … GROUP BY category_id, currency ORDER BY SUM DESC` |
| Movimientos recientes | `transactions.list({ limit: 5 })` (existente) | `ORDER BY local_date DESC, occurred_at DESC LIMIT 5` |
| Nombres e iconos | `loadReferences` (existente) | cuentas, tarjetas y categorías, archivadas incluidas |

Ningún método trae todos los movimientos a JavaScript. JavaScript solo suma valores ya agregados (enteros).

## Período

Mes actual del calendario civil del dispositivo: `monthRange(new Date())` de `shared/lib/dates/localDates.ts`, filtrando por `localDate` (rango inclusivo). El mes se calcula en cada carga, así que cambia al volver a la pantalla después de fin de mes. No hay selector de período.

## Reglas financieras

Se reutilizan las reglas existentes (`docs/domain-model.md`); el Dashboard no introduce reglas nuevas.

- **Dinero:** enteros en unidades menores (`amountMinor`). `formatMoney` solo convierte para mostrar.
- **Monedas:** todo se agrupa por `currency`. Nunca se suman monedas distintas ni se convierten. Con una sola moneda la pantalla se ve normal; con varias, cada moneda tiene su propio bloque (balance, mes, evolución y categorías) con su código como título, la moneda por defecto (`appConfig.defaultCurrency`) primero.
- **Archivados:** los movimientos con `deletedAt` no cuentan en nada (igual que en saldos y listados).
- **`pending`:** se incluye, igual que en `getAccountBalance`, porque su efecto sigue pendiente de decisión en el dominio.

### Balance total

Suma, por moneda, del saldo actual de cada **cuenta activa**, tal como lo muestra Cuentas (`listAccountBalances`, con el saldo inicial como respaldo). Por tanto:

- incluye saldos negativos (deuda de tarjetas de crédito);
- una transferencia entre cuentas propias no cambia el total;
- excluye cuentas archivadas, igual que Cuentas.

No es "ingresos − gastos". Muestra "Sin cuentas activas en XXX" si una moneda solo tiene movimientos de cuentas archivadas.

### Ingresos y gastos del mes

Suma de `type = 'income'` y `type = 'expense'` del mes. Las transferencias (`type = 'transfer'`) nunca cuentan.

### Tarjeta de crédito

La compra es un `expense` en la cuenta `credit_card`; el pago es un `transfer` banco → tarjeta. Como las transferencias no cuentan, una compra de Q500 pagada después suma Q500 de gasto, no Q1,000. En el balance, la compra deja la tarjeta en −Q500 y el pago la regresa a 0 restando del banco.

## Secciones

- **Balance total:** monto principal y aclaración "Saldo actual de tus cuentas activas".
- **Mes ("Octubre 2026"):** ingresos y gastos del mes con su icono y color semántico.
- **Evolución:** barras por día (ingreso y gasto lado a lado) para todos los días del mes, hechas con `View` (sin librería de gráficos). Los días sin movimientos quedan vacíos: no se generan valores. La altura es una proporción respecto al día máximo (solo presentación, con un mínimo visible para valores pequeños). Estado vacío: "Sin ingresos ni gastos este mes."
- **Gastos por categoría:** solo gastos del mes, de mayor a menor, con icono, nombre, monto y porcentaje del total de gastos del mes (el porcentaje es decimal solo para mostrar). Una categoría archivada con movimientos del mes se muestra con su nombre e icono y la marca "Archivada". Gastos sin categoría aparecen como "Sin categoría". Estado vacío: "Sin gastos este mes."
- **Movimientos recientes:** los 5 últimos (`RECENT_TRANSACTIONS_LIMIT`), de cualquier fecha, con `TransactionListItem` (misma presentación y signos que Movimientos). Al tocar uno se abre su detalle. Botón "Ver todos los movimientos".

## Estados

- **Carga:** `LoadingState` ("Cargando tu resumen") solo en la primera carga; las recargas mantienen los datos visibles (`useAsyncResource`).
- **Error:** `EmptyState` "No se pudo cargar tu resumen" con mensaje genérico y botón "Reintentar". No se muestran SQL ni detalles internos.
- **Base vacía** (sin cuentas activas y sin movimientos): `EmptyState` "Tu resumen está vacío" con "Agregar cuenta". Con cuentas pero sin movimientos se muestran los valores reales (balance y ceros).

## Refresh

`useReloadOnFocus`: la pantalla recarga al recuperar el foco (después de crear, editar o archivar movimientos, cuentas o categorías). Sin estado global ni event bus.

## Accesibilidad

- Balance, ingresos y gastos del mes se anuncian como una sola frase ("Gastos del mes: Q 500.00").
- La gráfica tiene `accessibilityRole="image"` y una descripción con el mes, los días con movimientos y los totales. Ningún dato depende solo de la gráfica: los totales están en el resumen.
- Encabezados de sección con `accessibilityRole="header"`; filas de categoría con nombre, monto y porcentaje.
- Montos grandes se ajustan al ancho (`adjustsFontSizeToFit`) en teléfonos pequeños.

## Testing

- `__tests__/db/dashboardQueries.test.ts` (SQLite real): sumas por día y moneda, transferencias excluidas, pago de tarjeta sin gasto duplicado, límites del rango, archivados, `pending`, monedas separadas, agrupación y orden por categoría, categoría archivada.
- `__tests__/dashboard/dashboardSummary.test.ts`: armado por moneda, balance con deuda, porcentajes y días del mes.
- `__tests__/dashboard/dashboardScreen.test.tsx` (rutas reales): base vacía, carga, error, cuenta sin movimientos, balance real, ingresos y gastos del mes, transferencias, tarjeta, mes anterior, archivados, categorías y su orden, categoría archivada, gráfica, límite de recientes y recarga al archivar.

## Limitaciones

- Solo el mes actual; no hay selector de período ni comparación con meses anteriores.
- Sin conversión de moneda: con varias monedas se muestran bloques separados.
- La gráfica muestra barras diarias simples, sin ejes de monto ni interacción.
- El reintento tras un error repite la misma lectura; si la base no está disponible, el error persiste.
- El mes actual depende del reloj y la zona horaria del dispositivo.
