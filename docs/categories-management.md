# Gestión de categorías

Las categorías clasifican gastos e ingresos (nunca transferencias). Se administran en Configuración → **Categorías**.

## Arquitectura

```
Screen (features/categories/screens)
  ↓ hooks (useCategories, useCategory, useCategoryRepository)
categoryRepository (features/categories/data)  ← validateCategory (domain)
  ↓
core/db (Drizzle sqlite-proxy) → op-sqlite → SQLite
```

Las pantallas no usan SQL, Drizzle ni op-sqlite. SQLite es la fuente de verdad y las pantallas recargan con `useReloadOnFocus`.

## Dominio

`Category`: `id`, `name`, `kind` (`expense` | `income`), `icon` y timestamps (`deletedAt` = archivada).

- `kind` existe porque el dominio permite categoría en ingresos y gastos, pero no en transferencias (regla 9). Una categoría de gastos solo clasifica gastos.
- `icon` es un nombre semántico del Icon System. El dominio guarda la lista permitida (`CATEGORY_ICONS`) como texto, sin depender de la UI; un test comprueba que todos existen en `iconRegistry`.
- `validateCategory(category, context)`: nombre obligatorio (máx. 40), tipo e icono válidos, y **nombre único por tipo** entre categorías activas, sin distinguir mayúsculas, acentos ni espacios (`normalizeCategoryName`). El mismo nombre puede existir en gastos y en ingresos.
- El tipo no se puede editar: los movimientos ya clasificados deben conservar una categoría de su mismo tipo.

## SQLite

Migración `0001_categories` (generada con drizzle-kit):

- Tabla `categories` con CHECK de `kind`, nombre no vacío y timestamps ISO UTC.
- Índice único parcial `(kind, lower(name)) WHERE deleted_at IS NULL`: segunda barrera de la regla de duplicados (`lower()` de SQLite solo pliega ASCII; el dominio cubre acentos).
- `icon` sin CHECK: agregar iconos no requiere migración; el dominio valida y el mapper usa `other` si encuentra un icono que la app ya no ofrece.
- FK `transactions.category_id → categories.id ON DELETE RESTRICT`. SQLite no permite agregar una FK a una tabla existente, así que drizzle-kit reconstruye `transactions` (`PRAGMA foreign_keys=OFF` antes de `BEGIN`, copia de filas, `foreign_key_check` antes de `COMMIT`). Probado con una base que ya tenía movimientos.

## Categorías predeterminadas

Migración de datos `0002_default_categories` (`drizzle-kit generate --custom`): 12 de gastos (Alimentación, Supermercado, Transporte, Vivienda, Salud, Educación, Entretenimiento, Compras, Servicios, Suscripciones, Viajes, Otros) y 2 de ingresos (Salario, Otros ingresos).

- Viven en la capa de datos, no en pantallas.
- IDs fijos: idénticos en cada instalación (útil para una futura sincronización).
- El runner aplica cada migración **una sola vez**: si el usuario archiva una categoría predeterminada, no reaparece.
- Son categorías normales: se editan y archivan como cualquier otra.

## Repositorio

`list({ kind?, includeArchived? })`, `getById`, `create`, `update` (nombre e icono), `softDelete`. Las reglas se validan antes de escribir (`InvalidCategoryError`).

## Archivar

- Soft delete (`deleted_at`) con confirmación previa.
- Las categorías archivadas no aparecen en las listas normales ni al registrar movimientos.
- Los movimientos que la usan conservan su `category_id` y la siguen mostrando (`list({ includeArchived: true })`). Una categoría usada nunca se borra físicamente (FK RESTRICT).
- Un nombre archivado puede reutilizarse en una categoría nueva.
- Si la categoría tiene un presupuesto activo, el presupuesto **no** se archiva: sigue calculándose y se marca "Categoría archivada" en Presupuestos. Una categoría archivada no recibe presupuestos nuevos (`docs/budgets.md`).

## UI

- `CategoriesScreen`: secciones Gastos e Ingresos con su acción "Agregar"; estados de carga, error con reintento y vacío.
- `CategoryFormScreen`: crear (con tipo preseleccionado según la sección) o editar y archivar.
- Selector de iconos accesible (radio con nombre en español de cada icono, área táctil de 48 dp).

## Testing

- Dominio: reglas, normalización, iconos existentes, tipos iguales al schema.
- Repositorio con SQLite real: semillas, creación, lectura, edición, duplicados, archivado, reutilización de nombres, segunda barrera (índice único, CHECK, FK).
- Migración de una instalación existente: conserva movimientos, FK activa, CHECK vigentes.
- Persistencia: escribir con una conexión y leer desde otra sobre el mismo archivo.
- UI sobre las rutas reales: navegación desde Configuración, carga, lista, vacío, error, validación, creación, edición, archivado y cancelación.
