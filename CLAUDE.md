# Control de Gastos

## Objetivo

Aplicación personal de control financiero que inicialmente tendrá una aplicación móvil Android/iOS y posteriormente un backend.

El objetivo es permitir registrar y consultar ingresos y gastos, categorías, presupuestos, ahorro, métricas y posteriormente automatizar la detección/importación de transacciones.

## Arquitectura

El repositorio es un monorepo.

Estructura prevista:

```
control-gastos/
├── mobile/
├── backend/
├── docs/
├── CLAUDE.md
└── README.md
```

### Mobile

Tecnologías principales:

- React Native 0.87.1
- TypeScript
- React
- Hermes
- React Native New Architecture

La aplicación móvil debe mantenerse multiplataforma.

Android-specific:

- Kotlin solamente cuando sea necesario implementar funcionalidad nativa de Android.
- No convertir toda la aplicación a Kotlin.
- La lógica general de negocio debe permanecer en TypeScript cuando sea apropiado.
- No modificar Android nativo sin aprobación previa, excepto cuando una dependencia o funcionalidad previamente aprobada requiera explícitamente cambios nativos. En ese caso, explicar primero los archivos y cambios.

### Backend

El backend se construirá posteriormente utilizando:

- NestJS
- TypeScript
- PostgreSQL

No crear backend todavía.

## Reglas de desarrollo

1. No modificar arquitectura, dependencias o tecnologías principales sin consultarlo primero.
2. No instalar paquetes sin explicar primero por qué son necesarios y qué problema resuelven.
3. Preferir soluciones simples y mantenibles.
4. Mantener separación clara entre UI, lógica de negocio, infraestructura y acceso a datos.
5. Evitar duplicación de código.
6. No introducir abstracciones innecesarias.
7. Mantener TypeScript en modo estricto.
8. Mantener compatibilidad con Android e iOS cuando sea posible.
9. Las funcionalidades específicas de Android deben estar aisladas del código multiplataforma.
10. No colocar secretos, API keys, contraseñas o credenciales en el repositorio.
11. Utilizar variables de entorno cuando corresponda.
12. No modificar archivos de configuración importantes sin explicar el motivo.
13. No eliminar código existente sin explicar qué se elimina y por qué.
14. No cambiar versiones de React Native, React, Node, Java, Gradle, Android SDK, NDK o Kotlin sin autorización.
15. Antes de realizar cambios grandes, analizar primero el estado actual del proyecto.

## Git

- La rama estable es main y la rama de integración es develop.
- Git está inicializado en la raíz del proyecto.
- No crear otro repositorio Git dentro de mobile/ ni backend/.
- No ejecutar push automáticamente.
- No crear commits automáticamente salvo que el usuario lo solicite explícitamente.
- Antes de un commit, revisar git status y los archivos que serán incluidos.

### Git Flow

Ramas principales:

- main: rama estable/producción.
- develop: rama de integración.
- feature/*: ramas de desarrollo de funcionalidades.

Reglas:

- No desarrollar directamente sobre main.
- No desarrollar funcionalidades directamente sobre develop.
- Las nuevas funcionalidades deben partir de develop.
- Las funcionalidades deben utilizar ramas feature/<nombre-descriptivo>.
- Las feature branches deben abrir Pull Request hacia develop.
- No hacer merge automático de una feature.
- No hacer push directo de funcionalidades a main.
- develop se integra hacia main mediante Pull Request.
- No crear release/*, hotfix/* u otras ramas hasta que el proyecto lo requiera.

Flujo:

```
develop
   ↓
feature/<nombre>
   ↓
Pull Request
   ↓
develop
   ↓
Pull Request
   ↓
main
```

### Reglas Git para Claude Code

- Trabajar en la feature branch correspondiente.
- No hacer commits directamente sobre main.
- No hacer commits de funcionalidades directamente sobre develop.
- No hacer merge de Pull Requests automáticamente.
- No hacer force push.
- Informar antes de operaciones que puedan reescribir historial.

## Calidad

Antes de considerar terminada una tarea:

- revisar TypeScript;
- revisar lint cuando corresponda;
- ejecutar las pruebas relevantes;
- verificar que Android compile cuando la modificación afecte Android;
- verificar que no se hayan introducido archivos generados o secretos.

## Forma de trabajo

Trabajar incrementalmente.

Para cada tarea:

1. Analizar primero.
2. Explicar brevemente el plan.
3. Implementar solamente lo solicitado.
4. Validar los cambios.
5. Informar qué archivos fueron modificados.
6. Informar las validaciones realizadas.
7. Detenerse y esperar nuevas instrucciones.

No asumir requisitos que el usuario no haya solicitado.

Si existe más de una solución válida para una decisión arquitectónica importante, presentar las opciones y explicar sus implicaciones antes de elegir.

## Estado actual

El proyecto móvil ya fue creado y probado exitosamente.

React Native 0.87.1 ejecuta correctamente en un emulador Android.

El entorno confirmado incluye:

- Node.js 22.16.0
- npm 10.9.2
- Java 17.0.12
- Android SDK
- Android API 37 / Build Tools 37.0.0
- NDK 27.1.12297006
- Android Emulator
- ADB funcionando

La aplicación móvil ya tiene una base de arquitectura sobre la plantilla oficial:

- Organización por features en `mobile/src/`: `app/` (navegación y providers), `core/` (configuración), `features/` (una carpeta por funcionalidad, con `domain/`, `components/`, `screens/` y un `index.ts` público) y `shared/` (componentes, tema y utilidades de dinero y fechas).
- Navegación con React Navigation: tabs principales, detalle de movimiento y modal de nuevo movimiento.
- Inicio y Movimientos usan datos de demostración (`demo/`). La gestión de cuentas y tarjetas (Configuración → Cuentas) y de categorías (Configuración → Categorías) usa datos reales de SQLite; ver `docs/accounts-management.md` y `docs/categories-management.md`.
- Modelo de dominio de `Account`, `Card` y `Transaction` con validación pura de transacciones. Las reglas están en `docs/domain-model.md`.
- Persistencia local SQLite en `mobile/src/core/db/` (tablas `accounts`, `cards`, `categories`, `transactions`) con repositories en `features/*/data/`. Detalles en `docs/domain-model.md` (sección Persistencia local).

Todavía no existen manejo de estado global, formularios funcionales ni backend.

## Persistencia local

- Stack aprobado: `@op-engineering/op-sqlite` + `drizzle-orm/sqlite-proxy` + `drizzle-kit` (migraciones). No usar `drizzle-orm/op-sqlite` (incompatible con op-sqlite >= 17 y sus transacciones no esperan callbacks async). No usar Expo ni `expo-sqlite`; `driver: 'expo'` en `drizzle.config.ts` solo define el formato de `migrations.js`.
- El dominio (`features/*/domain`) no importa `drizzle-orm` ni `op-sqlite`. Drizzle solo aparece en `core/db` y `features/*/data`. Los repositories devuelven entidades de dominio mediante mappers.
- Todo cambio de schema requiere una migración generada con `npm run db:generate`. Las migraciones ya integradas no se editan.
- Las foreign keys deben estar activas (`PRAGMA foreign_keys = ON`, verificado en `prepareDatabase`).
- Dinero siempre como INTEGER en unidades menores. Nunca REAL ni decimales.
- Atomicidad con `database.withTransaction`, no con `db.transaction()` de Drizzle.
- Los tests de base de datos usan SQLite real (`node:sqlite`, `createTestDatabase`); no se mockea SQL.

## UI

- Design System en `mobile/src/shared/theme/`: usar sus tokens (colores, tipografía, spacing, radius, sombras, iconografía); no colores ni tamaños literales en pantallas.
- Iconos solo mediante `Icon`, `IconBadge` e `IconButton` de `mobile/src/shared/icons/`. Nunca importar `lucide-react-native` fuera de esa carpeta (ESLint lo bloquea). Detalles en `docs/ui-icons.md`.
- Las pantallas leen y escriben mediante hooks de su feature que usan repositorios (`useDatabase()` de `core/db`); SQLite es la fuente de verdad y las pantallas recargan con `useFocusEffect`. Sin estado global.
- Montos escritos por el usuario: `parseMoney` (enteros en unidades menores, sin punto flotante).
