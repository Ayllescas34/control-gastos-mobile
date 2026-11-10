# Seguridad: bloqueo con PIN

Configuración → **Seguridad**. PIN de 6 dígitos para abrir la app. Solo Android (en iOS la pantalla explica que no está disponible).

## Cuándo se pide

- Al abrir la app, si hay PIN.
- Al volver a la app después de **1 minuto** fuera de ella (`RELOCK_AFTER_MS`). Volver antes no lo pide.
- La app queda montada debajo: la navegación y los formularios sin guardar se conservan. Mientras está bloqueada, la app está cubierta y oculta para el lector de pantalla.
- Con PIN activo, en Android 13+ la app aparece en blanco en "apps recientes" (`setRecentsScreenshotEnabled(false)`), sin bloquear las capturas de pantalla.

## Cómo se guarda (Kotlin, `security/PinStore.kt`)

- El PIN **nunca** se guarda. Se guarda `HMAC-SHA256(clave del Android Keystore, PBKDF2-SHA256(PIN, sal aleatoria de 16 bytes, 120 000 iteraciones))`.
- La clave HMAC vive en el **Android Keystore** y no se puede exportar: una copia de los archivos de la app no basta para probar el millón de PIN posibles fuera del teléfono.
- La comparación es de tiempo constante (`MessageDigest.isEqual`).
- SharedPreferences privadas; `allowBackup="false"`, así que no salen en respaldos de Android.
- El cálculo corre fuera del hilo de JS. Ni el PIN ni su hash aparecen en logs ni en mensajes de error.

## Intentos fallidos

Los cuenta el código nativo, así que JS no puede saltarse la espera:

| Fallos seguidos | Espera |
|---|---|
| 1–4 | ninguna |
| 5 | 30 s |
| cada fallo más | el doble, hasta 15 min |

Un PIN correcto reinicia el contador. Mientras hay espera, el teclado está deshabilitado y la pantalla muestra el tiempo restante.

## PIN nuevo

- Se escribe dos veces. Se rechazan los PIN triviales: un mismo dígito (`111111`) o una secuencia (`123456`, `987654`).
- **Cambiar** pide el PIN actual; **desactivar** también.
- **Olvidé mi PIN:** se elige un PIN nuevo y se confirma con el **bloqueo de pantalla del teléfono** (PIN, patrón o contraseña del sistema, `KeyguardManager`). Si el teléfono no tiene bloqueo de pantalla, no se puede recuperar así.
- Si no se puede leer el estado del bloqueo, la app **falla cerrada**: pide el PIN.

## Archivos

| Capa | Archivo |
|---|---|
| Android | `android/.../security/PinStore.kt`, `AppLockModule.kt`, `AppLockPackage.kt`; `MainActivity.kt` (recientes) |
| Puente | `src/core/native/specs/NativeAppLock.ts`, `src/core/native/appLock.ts` |
| Dominio | `src/features/security/domain/pinRules.ts` |
| UI | `AppLockGate` (en `AppProviders`, antes que la base de datos), `LockScreen`, `PinPad` (teclado propio: el del sistema podría guardar o sugerir dígitos), `NewPinFlow`, `SecurityScreen` |

## Pruebas

`__tests__/security/appLock.test.tsx`, con un módulo nativo simulado: reglas del PIN, bloqueo al abrir, PIN incorrecto, espera tras 5 fallos (el PIN correcto no entra mientras se espera), volver antes y después de 1 minuto, recuperar con el bloqueo del teléfono.

## Pendiente (plan de seguridad)

Siguen pendientes del plan de seguridad: cifrar la base de datos (SQLCipher con clave en el Keystore), firmar el release con una clave propia, R8 y respaldo cifrado. Ver la conversación del plan OWASP MASVS.
