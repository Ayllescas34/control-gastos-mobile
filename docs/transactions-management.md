# Gestión de movimientos

Registro real de gastos, ingresos y transferencias en SQLite. Reemplaza los movimientos de demostración en **Movimientos**, en el detalle y en "Movimientos recientes" del Inicio (el resumen del Inicio sigue siendo demo, marcado con su badge).

## Arquitectura

```
Screen (features/transactions/screens)
  ↓ hooks (useTransactions, useTransactionDetail, useTransactionFormData)
transactionRepository  ← validateTransaction (domain)
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- Las pantallas no usan SQL, Drizzle ni op-sqlite. Filtros y búsqueda se resuelven en el repositorio (SQL), no sobre lo renderizado.
- `referenceLookup` indexa cuentas, tarjetas y categorías (incluidas las archivadas) una vez por carga para nombrar cada movimiento.
- `describeTransaction` es la única presentación de un movimiento (lista, Inicio, detalle).
- Las features se importan por módulo (`../../accounts/data/...`), no por su `index`, para evitar ciclos entre features.

## Dominio

Modelo `Transaction` existente, sin cambios de campos. `validateTransaction(transaction, context)`:

- **Campos:** monto entero y > 0; fecha civil real (`local_date_invalid`, p. ej. 2026-02-30); reglas de transferencia (destino obligatorio y distinto, sin categoría ni tarjeta); `toAccountId` solo en transferencias.
- **Relaciones** (`context` = cuentas, tarjetas y categorías utilizables):
  - la cuenta y la cuenta destino existen (`account_not_found`, `to_account_not_found`);
  - la moneda coincide con la de la cuenta y la del destino (`currency_mismatch`, reglas 6 y 10: sin FX);
  - la tarjeta pertenece a la cuenta (regla 13);
  - la categoría existe y es del mismo tipo (`category_not_found`, `category_kind_mismatch`).
- **Qué es utilizable lo decide el repositorio:** al crear, solo entidades activas; al editar, también las que el movimiento ya tenía (un gasto antiguo conserva su categoría o tarjeta archivada).

## Tipos de movimiento

| Tipo | Campos | Efecto en saldos |
|---|---|---|
| Gasto (`expense`) | monto, cuenta, categoría, tarjeta opcional, fecha, comercio, descripción, nota | resta de la cuenta |
| Ingreso (`income`) | monto, cuenta, categoría, fecha, origen, descripción, nota | suma a la cuenta |
| Transferencia (`transfer`) | monto, cuenta origen, cuenta destino, fecha, descripción, nota | resta del origen, suma al destino; no es ingreso ni gasto |

El formulario muestra primero el tipo y después solo sus campos. Al cambiar de tipo o de cuenta se descartan selecciones incompatibles (tarjeta de otra cuenta, categoría del otro tipo, destino igual al origen). La moneda es la de la cuenta.

## Pago de tarjeta de crédito

Una transferencia de la cuenta bancaria a la cuenta `credit_card` (reglas 14 y 15). **No genera otro gasto**: el gasto ya quedó registrado en cada compra (`expense` con `cardId` en la cuenta de crédito). El formulario lo indica al elegir una cuenta de crédito como destino.

## Dinero y fechas

- `parseMoney`: el texto (`450.75`, `1,250.75`) se convierte a enteros en unidades menores (`45075`) sin punto flotante.
- `localDate` es la fecha civil elegida ("Hoy", "Ayer" u otra en AAAA-MM-DD); `occurredAt` es el instante actual si es hoy, o el mediodía local de ese día. Al editar sin cambiar la fecha se conserva el `occurredAt` original. Solo date-fns (ya existente).
- Al editar se conservan `source`, `status` y `externalRef` del movimiento.

## Saldos

Derivados, nunca almacenados: saldo inicial + ingresos + transferencias entrantes − gastos − transferencias salientes, sobre movimientos no archivados (`pending` incluido: su efecto sigue pendiente de decisión en el dominio).

- `getAccountBalance(id)` (detalle de cuenta) y `listAccountBalances()` (lista de cuentas, **una sola consulta** con `GROUP BY`) comparten la misma expresión SQL: una sola fuente de verdad.
- Cuentas muestra ahora el saldo actual; el saldo inicial queda como dato en el detalle.

## Repositorio

`list(filters)`, `getById`, `create`, `update`, `softDelete`, `listByAccount`, `getAccountBalance`, `listAccountBalances`.

Filtros (`TransactionFilters`, combinables): `type`, `accountId` (origen o destino), `categoryId`, `from`/`to` (rango inclusivo de `localDate`), `search` (contiene, en `payee`, `description` y `note`; `%`, `_` y `\` se buscan literalmente), `limit`.

## Movimientos (UI)

- Lista agrupada por día (Hoy, Ayer, fecha), con icono de la categoría o del tipo, título (comercio, descripción, categoría o tipo), cuentas, fecha y monto con signo y color.
- Búsqueda con espera de 300 ms tras dejar de escribir; tipo como chips; "Más filtros": período (este mes, mes anterior, últimos 30 días), cuenta y categoría; "Quitar filtros".
- Estados: carga, error con reintento, vacío ("No tienes movimientos todavía" + "Agregar movimiento") y sin resultados para los filtros.
- Detalle con todos los campos (origen → destino en transferencias; categoría, tarjeta o cuenta marcadas como archivadas si lo están), editar y archivar con confirmación.
- El botón **+** abre el formulario (gasto, ingreso o transferencia). Sin cuentas, ofrece crear una.

## Soft delete

Archivar un movimiento es `UPDATE deleted_at`: deja de listarse y de contar en saldos; nada se borra físicamente.

## Seguridad

Un movimiento guarda solo `cardId`. Nunca número completo de tarjeta, CVV ni PIN.

## Limitaciones conocidas

- La búsqueda ignora mayúsculas solo en ASCII (`LIKE` de SQLite): "cafe" no encuentra "Café".
- Sin paginación: `list` devuelve todos los movimientos que cumplen los filtros (el Inicio usa `limit`).
- `status` es siempre `confirmed` en movimientos manuales.

## Testing

- Dominio: reglas de campos y de relaciones, fechas reales.
- Repositorio con SQLite real: categorías por tipo, archivadas al crear y al editar, cuentas y moneda, tarjeta archivada, filtros (tipo, cuenta con transferencias entrantes, categoría, fechas), búsqueda y escape, combinación y límite, saldos en lote iguales a los individuales, pago de tarjeta sin gasto duplicado.
- Persistencia: escribir con una conexión y leer movimientos y saldos desde otra sobre el mismo archivo.
- Modelos puros: formulario, filtros, presentación, fechas.
- UI sobre las rutas reales: vacío, carga, error, lista, creación de gasto/ingreso/transferencia, validación, detalle, edición, archivado, búsqueda, filtros, Inicio y saldos en Cuentas.
