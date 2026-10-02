# Gestión de cuentas y tarjetas

Primera funcionalidad con datos reales persistidos en SQLite: el usuario crea, consulta, edita y archiva sus cuentas y tarjetas. No hay datos de demostración: una instalación nueva muestra "No tienes cuentas todavía".

> **Seguridad: nunca almacenar el número completo de tarjeta, el CVV ni el PIN.** Solo se guardan `alias`, `last4` (exactamente 4 dígitos) y opcionalmente `network`. El formulario solo acepta dígitos y como máximo 4; el dominio y la base de datos rechazan cualquier otro valor.

## Arquitectura

```
Screen (features/accounts/screens)
  ↓ hooks (features/accounts/hooks): useAccountsOverview, useAccountDetail, useCardDetail, useAccountRepositories
Repository (features/accounts/data): accountRepository, cardRepository  ← validateAccount / validateCard (domain)
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

- Las pantallas no importan Drizzle, op-sqlite ni SQL. Obtienen repositorios con `useAccountRepositories()`, que usa `useDatabase()` de `core/db`.
- `DatabaseContext`/`useDatabase` viven en `core/db` (antes en `app/providers`) para que las features no dependan de `app/`.
- No hay estado global: SQLite es la fuente de verdad. `useAsyncResource` (`shared/hooks`) refleja el último resultado y los hooks recargan con `useFocusEffect` al volver a cada pantalla (después de crear, editar o archivar).

```
features/accounts/
├── domain/      types (ACCOUNT_TYPES, CARD_NETWORKS), validateAccount, validateCard, accountErrors
├── data/        repositories y mappers
├── hooks/       consultas y repositorios
├── components/  AccountForm, CardForm, AccountListItem, CardListItem, modelos de formulario, textos e iconos
└── screens/     Accounts, AccountDetail, AccountForm, CardDetail, CardForm
```

## Account

Modelo existente sin cambios de schema: `name`, `type` (`cash`, `bank`, `savings`, `credit_card`, `other`), `currency`, `initialBalanceMinor` y timestamps.

- `validateAccount`: nombre obligatorio (sin espacios sobrantes, máx. 60), tipo del dominio, moneda ISO de 3 letras y saldo inicial entero seguro (puede ser negativo: deuda).
- La moneda no se puede editar (regla 6 del dominio). Las cuentas nuevas usan `appConfig.defaultCurrency` (GTQ); no hay multimoneda ni conversión.
- Se muestra el **saldo actual**: saldo inicial más los movimientos registrados, calculado por `transactionRepository` (`listAccountBalances` en la lista, `getAccountBalance` en el detalle). El saldo inicial queda como dato en el detalle. Ver `docs/transactions-management.md`.

## Card

Modelo existente sin cambios de schema: `accountId`, `alias`, `last4`, `network` y timestamps. No existen límite ni fechas de corte o pago en el modelo, por lo que no se piden.

- `validateCard`: alias obligatorio (máx. 40), `last4` de exactamente 4 dígitos, red válida o nula, y cuenta existente y activa.
- Crédito o débito no es un campo de la tarjeta: lo determina el tipo de la cuenta (regla 11). Por eso cualquier tipo de cuenta puede tener tarjetas.
- La cuenta de una tarjeta no se puede cambiar al editar: las transacciones referencian `(card_id, account_id)`.

## Repositorios

| | Operaciones |
|---|---|
| `accountRepository` | `create`, `getById`, `list`, `update`, `softDelete` |
| `cardRepository` | `create`, `getById`, `list`, `listByAccount`, `update`, `softDelete` |

Las reglas de dominio se ejecutan antes de escribir (`InvalidAccountError`, `InvalidCardError`); las CHECK y foreign keys de SQLite son la segunda barrera.

## Soft delete (archivar)

- Archivar es `UPDATE deleted_at`. Las listas y lecturas normales excluyen archivados. Nada se borra físicamente.
- **Decisión:** una cuenta con tarjetas activas no se puede archivar (`AccountHasActiveCardsError`). No hay cascada: primero se archivan sus tarjetas. Así ninguna tarjeta activa apunta a una cuenta oculta. La UI lo explica antes de pedir confirmación.
- No se pueden crear tarjetas en una cuenta archivada.

## Navegación

Configuración → **Cuentas** (pantallas en el stack raíz, como el detalle de movimientos). Las tabs no cambian.

| Ruta | Uso |
|---|---|
| `Accounts` | Secciones Cuentas y Tarjetas, cada una con su acción "Agregar" |
| `AccountDetail` | Saldo inicial, datos, tarjetas de la cuenta, editar y archivar |
| `AccountForm` | Crear o editar (`accountId`) |
| `CardDetail` | Alias, `•••• 1234`, red, cuenta, editar y archivar |
| `CardForm` | Crear (con `accountId` opcional preseleccionado) o editar (`cardId`) |

## Formularios

Sin librería de formularios: estado local controlado.

- `accountFormModel` y `cardFormModel` convierten lo escrito en entradas del dominio y reutilizan `validateAccount`/`validateCardFields`; solo asignan cada error a su campo y mensaje.
- Selección cerrada con `ChoiceGroup` (tipo de cuenta, red, cuenta): nunca texto libre.
- Dinero: `parseMoney` (`shared/lib/money`) convierte texto como `12,500.50` en `1250050` con operaciones de texto y enteros, sin punto flotante. "." es decimal y "," agrupa miles (es-GT). Más decimales de los permitidos se rechazan, no se redondean.
- `useFormSubmission` (`shared/hooks`) evita el doble envío, muestra el estado de guardado y presenta los errores (nunca los oculta).

## Componentes compartidos nuevos

`TextField`, `ChoiceGroup`, `ListItem`, `SectionHeader`, `DetailRow`, `LoadingState` (`shared/components`); `Button` admite `disabled`, `loading` y variante `danger`; `EmptyState` admite `tone`; `IconTone` admite `error`.

## Testing

- Dominio: `validateAccount`, `validateCard`, listas del dominio iguales a las del schema.
- Dinero: `parseMoney`/`formatMoneyInput` (exactitud, límites, ida y vuelta).
- Repositorios con SQLite real (`node:sqlite`): validación, listas sin archivados, bloqueo de archivado, segunda barrera de la base de datos.
- Persistencia: escribir con una conexión y leer desde otra nueva sobre el mismo archivo SQLite.
- UI: las rutas reales (`RootStack`, vía `renderRootStack`) sobre SQLite real: carga, vacío, listas, error con reintento, navegación desde Configuración, formularios (validación, creación, edición, guardado y doble envío) y archivado (confirmación, cancelación, bloqueo y error).
