# Reportes

Resumen financiero real de un mes elegido, calculado exclusivamente con los datos persistidos en SQLite. Reemplaza el placeholder de la pestaña Reportes. No hay datos de demostración.

## Arquitectura

```
ReportsScreen (features/reports/screens)
  ↓ useReportMonth · useMonthlyReport (features/reports/hooks)
  ↓   buildMonthlyReport (features/reports/domain, función pura)
  ↓     summarizeByCurrency (features/dashboard/domain, la misma agregación que Inicio)
transactionRepository · loadReferences
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- La pantalla no ejecuta SQL ni hace cálculos financieros: solo pinta lo que entrega `useMonthlyReport`.
- No existe un `reportRepository`. Las consultas agregadas pertenecen a la tabla `transactions` y son las mismas del Dashboard.
- Reutiliza componentes de Inicio, importados por módulo: `CategoryBreakdown`, `EvolutionChart` y `formatPeriodLabel`/`formatShare` de `dashboardPresentation`. Aceptan un prefijo de `testID`, el mensaje vacío y la descripción del período; los valores por defecto dejan Inicio igual.
- Componentes propios: `MonthSelector`, `ReportSummary` y `reportPresentation` (texto de conteos).

## Fuente de datos

Una carga hace, en paralelo:

| Dato | Método | SQL |
|---|---|---|
| Ingresos/gastos por día | `transactions.listDailyTotals(range)` (existente) | `SUM … GROUP BY local_date, type, currency` |
| Gastos por categoría | `transactions.listExpenseTotalsByCategory(range)` (existente) | `SUM … GROUP BY category_id, currency ORDER BY SUM DESC` |
| Cantidad de movimientos | `transactions.listMovementCounts(range)` (nuevo) | `COUNT(*) … GROUP BY type, currency` |
| Nombres e iconos | `loadReferences` (existente) | cuentas, tarjetas y categorías, archivadas incluidas |

- `listDailyTotals` y `listMovementCounts` comparten la condición `incomeAndExpenseIn(range)`, así que los totales y los conteos describen siempre las mismas filas.
- Ningún método trae los movimientos a JavaScript: son tres consultas agregadas por mes, sin consultas por categoría ni por día. Usan el índice existente `transactions_local_date_idx`. No hay migración.
- Medición: con 36 000 movimientos en SQLite de Node, las consultas del mes tardan unos 22 ms (prueba "large history" de `reportQueries.test.ts`, medida una vez a mano; la prueba no mide tiempos).

## Período

- Un mes del calendario civil, representado por su primer día (`YYYY-MM-01`). Al abrir la pestaña se muestra el mes actual del dispositivo.
- `monthRangeOf(localDate, monthsAgo)` (`shared/lib/dates`) calcula el rango a partir de fechas civiles, así que no se desplaza por zona horaria. Maneja el cambio de año y la duración de cada mes, incluidos los bisiestos.
- El filtro es por `localDate`, con un rango inclusivo del día 1 al último día del mes: el mismo criterio que Inicio y Presupuestos.
- **Navegación:** "Mes anterior" sin límite inferior; "Mes siguiente" deshabilitado en el mes actual (no se navega a meses futuros); "Volver al mes actual" solo aparece fuera del mes actual.
- El mes elegido es estado local de la pantalla (no hay estado global). Al cambiar de mes la pantalla vuelve a leer; mientras tanto muestra la carga, nunca las cifras del mes anterior bajo el nuevo título.

## Métricas y reglas financieras

Se reutilizan las reglas existentes (`docs/domain-model.md`, `docs/dashboard.md`); Reportes no introduce reglas nuevas.

| Métrica | Fórmula |
|---|---|
| Ingresos | Suma de `type = 'income'` del mes |
| Gastos | Suma de `type = 'expense'` del mes |
| Balance del mes | Ingresos − Gastos (puede ser negativo) |
| Cantidad de ingresos / gastos | `COUNT(*)` de esas mismas filas |
| Gasto por categoría | Suma de `expense` por `category_id`; "Sin categoría" cuando es nulo |
| Proporción | Gasto de la categoría ÷ gastos del mes de la **misma moneda** (`formatShare`) |
| Actividad | Ingresos y gastos por día |

- **Dinero:** enteros en unidades menores. JavaScript solo suma enteros ya agregados. La proporción se divide únicamente para construir el texto; no se muestra cuando los gastos son 0, así que nunca hay división por cero.
- **Transferencias:** nunca son ingresos ni gastos. Un mes con solo transferencias se muestra como "Sin movimientos" e indica que las transferencias no cuentan.
- **Tarjeta de crédito:** la compra es un `expense` de la cuenta `credit_card` y cuenta como gasto. El pago es un `transfer` banco → tarjeta y no cuenta, así que no se duplica.
- **Archivados:** los movimientos con `deletedAt` no cuentan.
- **`pending`:** se incluye, igual que en saldos, Inicio y Presupuestos, mientras su efecto siga pendiente de decisión en el dominio.
- **Cuentas archivadas:** sus movimientos no archivados siguen contando en los meses en que ocurrieron, igual que en Inicio y Presupuestos (son historia). El reporte no muestra saldos de cuentas.
- **Categorías archivadas:** aparecen con su nombre, su icono y la marca "Archivada" en los meses en que se usaron.
- **El balance del mes no es el saldo de las cuentas.** El "Balance total" de Inicio es el saldo actual de las cuentas activas; el reporte muestra el resultado del mes.

## Monedas

El mismo patrón que Inicio. Todo se agrupa por `currency`: nunca se suman monedas distintas ni se convierten. Con una moneda la pantalla se ve normal. Con varias, cada moneda tiene su propio bloque (resumen, categorías y actividad) con su código como título, la moneda por defecto (`appConfig.defaultCurrency`) primero. Las proporciones se calculan dentro de cada moneda.

## Secciones

- **Selector de mes:** "Octubre 2026" con "Mes actual" cuando corresponde, y los botones anterior, siguiente y volver.
- **Resumen:** ingresos y gastos con su cantidad de movimientos ("Sin movimientos", "1 movimiento", "3 movimientos") y el balance del mes, en rojo de gasto cuando es negativo.
- **Gastos por categoría:** solo categorías con gasto en el mes, de mayor a menor, con icono, nombre, monto y porcentaje. Sin gastos: "Sin gastos en este mes."
- **Evolución (actividad):** barras diarias de ingresos y gastos (`EvolutionChart`, hechas con `View`, sin librería de gráficos). Los días sin movimientos quedan vacíos.

## Estados

- **Carga:** `LoadingState` ("Cargando el reporte") bajo el selector, en la primera carga y al cambiar de mes.
- **Error:** "No se pudo cargar el reporte" con "Reintentar". No muestra SQL ni detalles internos. El selector sigue disponible.
- **Mes sin ingresos ni gastos:** "Sin movimientos" con la aclaración sobre las transferencias.
- **Solo ingresos:** gastos en 0 con "Sin movimientos" y "Sin gastos en este mes."
- **Solo gastos:** ingresos en 0 y balance negativo.
- **Montos grandes:** se ajustan al ancho (`adjustsFontSizeToFit`).

## Refresh

`useReloadOnFocus`: la pantalla recarga al recuperar el foco (después de crear, editar o archivar en otra pantalla) y al cambiar de mes.

## Accesibilidad

- El mes se anuncia como encabezado ("Reporte de Octubre 2026, mes actual"), con región viva para anunciar el cambio.
- Los botones solo con icono tienen etiqueta ("Mes anterior", "Mes siguiente"). "Mes siguiente" se anuncia deshabilitado en el mes actual.
- Cada fila del resumen es una frase ("Gastos: Q 650.75, 2 movimientos"; "Balance del mes: -Q 300.00").
- La gráfica tiene `accessibilityRole="image"` y una descripción con el mes, los días con movimientos y los totales. Ningún dato depende solo de la gráfica: los totales están en el resumen.
- Las filas de categoría anuncian nombre, monto, porcentaje y si está archivada.

## Testing

- `__tests__/db/reportQueries.test.ts` (SQLite real):
  - conteos por tipo y moneda;
  - transferencias, archivados y `pending`;
  - mes con ingresos y gastos, vacío, solo ingresos y solo gastos;
  - compra con tarjeta y pago sin duplicar;
  - límites exactos entre meses y años;
  - categoría archivada y monedas separadas;
  - consistencia con `summarizeByCurrency` (Inicio) y `buildBudgetOverview` (Presupuestos);
  - 36 000 movimientos contra un cálculo independiente.
- `__tests__/reports/monthlyReport.test.ts`:
  - armado por moneda, balance negativo, enteros grandes y orden de categorías;
  - porcentajes y total cero;
  - conteos;
  - `monthRangeOf` (cambio de año, bisiestos).
- `__tests__/reports/reportsScreen.test.tsx` (rutas reales):
  - carga, error recuperable, mes vacío y mes solo con transferencias;
  - resumen con tarjeta y archivados, solo gastos y solo ingresos;
  - categorías con su orden, porcentaje y archivada;
  - gráfica accesible y monedas separadas;
  - navegación anterior, siguiente, sin futuro y vuelta al mes actual.

## Limitaciones

- Solo meses completos: sin rango personalizado, semanas, años ni comparación entre meses.
- "Mes anterior" no tiene límite inferior: los meses anteriores al primer movimiento se muestran como "Sin movimientos".
- Sin presupuestos del mes elegido: Presupuestos sigue mostrando solo el mes actual.
- Sin conversión de moneda: con varias monedas se muestran bloques separados.
- Las proporciones se redondean a un decimal para mostrarlas, así que pueden no sumar exactamente 100 %.
- La gráfica es la de Inicio: barras diarias simples, sin ejes de monto ni interacción.
- No se puede tocar una categoría para ver sus movimientos.
- El mes actual depende del reloj y la zona horaria del dispositivo. Si el mes cambia con la pantalla abierta, el mes elegido no cambia solo.
