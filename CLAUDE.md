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

- La rama principal es main.
- Git está inicializado en la raíz del proyecto.
- No crear otro repositorio Git dentro de mobile/ ni backend/.
- No ejecutar push automáticamente.
- No crear commits automáticamente salvo que el usuario lo solicite explícitamente.
- Antes de un commit, revisar git status y los archivos que serán incluidos.

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

El proyecto móvil actualmente es el proyecto generado por la plantilla oficial de React Native y todavía no se ha comenzado el desarrollo funcional de Control de Gastos.
