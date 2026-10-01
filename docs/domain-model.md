# Modelo de dominio

Reglas de negocio de las entidades `Account`, `Card` y `Transaction`.

Los tipos viven en:

- `mobile/src/shared/domain/types.ts`: `EntityId`, `IsoDateTime`, `LocalDate`, `Timestamps`.
- `mobile/src/shared/lib/money`: `CurrencyCode`, `MinorUnits`.
- `mobile/src/features/accounts/domain/types.ts`: `Account`, `AccountType`, `Card`, `CardNetwork`.
- `mobile/src/features/transactions/domain/types.ts`: `Transaction`, `TransactionType`, `TransactionSource`, `TransactionStatus`.
- `mobile/src/features/transactions/domain/validateTransaction.ts`: validación de invariantes de `Transaction`.

## Entidades y relaciones

```
Account 1 ──── 0..n Card          card.accountId → account.id
Account 1 ──── 0..n Transaction   transaction.accountId (cuenta afectada / origen)
Account 1 ──── 0..n Transaction   transaction.toAccountId (destino, solo en transfer)
Card    1 ──── 0..n Transaction   transaction.cardId (plástico usado, opcional)
Category         0..1 por Transaction   transaction.categoryId (entidad pendiente)
```

Tipos de cuenta: `cash`, `bank`, `savings`, `credit_card`, `other`.

## Dinero

1. Los montos se almacenan como enteros en la unidad menor de la moneda (por ejemplo, centavos). Nunca como decimales `float`.
2. `Transaction.amountMinor` siempre es un entero mayor que 0. El signo lo determina `type`.
3. `Account.initialBalanceMinor` es un entero con signo. Negativo indica deuda.
4. El saldo actual de una cuenta no se almacena. Se calcula como `initialBalanceMinor` más el efecto de sus transacciones.

## Moneda

5. Cada transacción guarda su `currency` explícitamente (código ISO 4217).
6. La moneda de una transacción debe coincidir con la moneda de su cuenta.
7. GTQ es la moneda por defecto (`appConfig.defaultCurrency`), pero el modelo acepta cualquier moneda.

## Efecto de cada tipo de transacción

| Tipo | Efecto en saldos | Cuenta en totales |
|---|---|---|
| `income` | suma `amountMinor` a `accountId` | como ingreso |
| `expense` | resta `amountMinor` de `accountId` | como gasto |
| `transfer` | resta de `accountId`, suma a `toAccountId` | no es ingreso ni gasto |

`income` y `expense` tienen `toAccountId = null`.

## Transferencias

8. `toAccountId` es obligatorio y distinto de `accountId`.
9. `categoryId` y `cardId` son `null`.
10. Por ahora ambas cuentas deben tener la misma moneda. Las transferencias con cambio de divisa quedan fuera del alcance actual.

## Tarjetas

11. Una tarjeta pertenece a una cuenta mediante `accountId`. Si es de crédito o de débito lo determina el `type` de esa cuenta.
12. Una compra con tarjeta es un `expense` con `accountId` igual a la cuenta de la tarjeta y `cardId` igual al plástico usado.
    - Crédito: `accountId` es la cuenta `credit_card`.
    - Débito: `accountId` es la cuenta bancaria.
13. Si una transacción tiene `cardId`, esa tarjeta debe pertenecer a `transaction.accountId`.

## Pago de tarjeta de crédito

14. El pago de una tarjeta de crédito es un `transfer`: `accountId` es la cuenta bancaria y `toAccountId` es la cuenta `credit_card`.
15. El pago no genera un segundo `expense`. El gasto ya quedó registrado en cada compra.
16. El saldo de una cuenta `credit_card` es negativo cuando hay deuda. Una compra lo hace más negativo y un pago lo acerca a 0.

## Datos sensibles

17. Nunca se almacenan el número completo de tarjeta, el CVV, el PIN ni la fecha de vencimiento.
18. Solo se guardan `alias`, `last4` (string de exactamente 4 dígitos) y opcionalmente `network`.

## Fechas

19. `occurredAt` es el instante UTC del movimiento (ISO 8601).
20. `localDate` es la fecha civil (`YYYY-MM-DD`) en la zona horaria del dispositivo al registrar. Se usa para agrupar y para los reportes, así el día no cambia por la zona horaria.
21. `createdAt`, `updatedAt` y `deletedAt` son instantes UTC.

## Borrado lógico

22. Un registro con `deletedAt` distinto de `null` está borrado y se excluye de saldos y listados.
23. Una cuenta con transacciones no se borra físicamente.

## Validación

`validateTransaction(transaction, context)` es una función pura que devuelve `{ valid, errors }` con todas las reglas incumplidas. Separa dos grupos:

- `validateTransactionFields`: reglas que solo necesitan la transacción (monto; `toAccountId`, `categoryId` y `cardId` según el tipo).
- `validateTransactionRelations`: reglas que necesitan otras entidades, que el llamador pasa en `context`. Hoy: que la tarjeta pertenezca a `accountId`.

Todavía no se valida en código que la moneda coincida con la de la cuenta (reglas 6 y 10), porque requiere recibir las cuentas.

## Decisiones pendientes

Estos puntos **no están decididos**:

- **PENDIENTE:** si una transacción con `status = 'pending'` afecta el saldo. Mientras no se decida, `getAccountBalance` incluye todas las transacciones no borradas, sin filtrar por `status`.
- **PENDIENTE:** si la combinación `source` + `externalRef` debe ser única (para evitar duplicados en importaciones). Por ahora no existe `UNIQUE(source, external_ref)`; se agregará con una migración en la etapa de importación/integración.

## Persistencia local

SQLite en el dispositivo (`mobile/src/core/db/`). El schema Drizzle está en `core/db/schema/` y la migración inicial en `core/db/migrations/`.

- **IDs:** `TEXT PRIMARY KEY` con UUID v4 generado por la app (sin AUTOINCREMENT). Hermes no expone `crypto` en este proyecto (verificado en el emulador), así que los 16 bytes aleatorios salen de `randomblob()` de SQLite (`core/db/ids.ts`), sin dependencias nuevas.
- **Fechas:** `TEXT`. Instantes en ISO UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; `local_date` como `YYYY-MM-DD`. Validados con `CHECK ... GLOB`.
- **Dinero:** `INTEGER`. `CHECK(typeof(...) = 'integer')` rechaza REAL, con límite `abs <= 2^53 - 1` para que JS lo represente exactamente. `amount_minor > 0`.
- **Reglas en la base de datos (segunda barrera):** tipos/source/status/network permitidos, moneda de 3 letras, `last4` de 4 dígitos y reglas de transferencia (reglas 8 y 9) como `CHECK`. La regla 13 (tarjeta de la misma cuenta) con `UNIQUE(cards.id, cards.account_id)` y la FK compuesta `transactions(card_id, account_id) → cards(id, account_id)`. Todas las FK usan `ON DELETE RESTRICT`.
- **`category_id`:** `TEXT NULL` sin FK hasta que exista la tabla `categories`.
- **Borrado lógico:** los repositories solo hacen `UPDATE deleted_at`; las lecturas normales filtran `deleted_at IS NULL`. Los índices de `transactions` son parciales sobre filas no borradas.
- **Saldo:** se calcula con SQL (`getAccountBalance`), no se almacena.
- **Migraciones:** runner propio (`core/db/migrate.ts`) que aplica cada migración en su propia transacción y la registra en `schema_migrations`. Si una migración desactiva foreign keys, se desactivan antes de `BEGIN`, se ejecuta `PRAGMA foreign_key_check` antes de `COMMIT` y se reactivan al terminar.
