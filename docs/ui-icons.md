# Sistema de iconos

Iconografía centralizada de Control de Gastos. Las pantallas usan nombres semánticos propios (`<Icon name="home" />`) y nunca importan la librería de iconos directamente.

## Estructura

```
mobile/src/shared/icons/
├── iconRegistry.ts   # nombre semántico → glifo de Lucide (único lugar que importa Lucide)
├── iconTypes.ts      # IconName, IconSize, IconTone, IconContainerSize, IconProps
├── iconTones.ts      # colores por tono y tamaños de contenedor (compartidos)
├── Icon.tsx
├── IconBadge.tsx
├── IconButton.tsx
└── index.ts          # API pública
```

Dependencias: `react-native-svg` (renderizado nativo, New Architecture) y `lucide-react-native` (glifos de trazo).

## Icon

```tsx
<Icon name="home" />
<Icon name="arrowDown" size="lg" color="income" />
<Icon name="warning" color="warning" accessibilityLabel="Advertencia" />
```

| Prop | Tipo | Por defecto |
|---|---|---|
| `name` | `IconName` | requerido |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` (16/20/24/32) o número | `'md'` |
| `color` | token del theme (`ColorName`), nunca un color literal | `'textPrimary'` |
| `strokeWidth` | número | `iconStrokeWidth` del theme (2) |
| `accessibilityLabel` | string | decorativo |
| `style`, `testID` | | |

## IconBadge

Icono dentro de un contenedor tintado (por ejemplo, el tipo de un movimiento).

```tsx
<IconBadge name="arrowUp" variant="expense" />
<IconBadge name="chart" variant="primary" size="lg" />
```

- `variant`: `primary`, `income`, `expense`, `transfer`, `neutral` (por defecto), `warning`, `error`.
- `size`: `sm` (32), `md` (40, por defecto), `lg` (48).
- El fondo se deriva del color del tono con `withAlpha` (12% en light, 20% en dark). `neutral` usa `surfaceMuted`.

## IconButton

Acción representada solo con un icono.

```tsx
<IconButton
  icon="search"
  accessibilityLabel="Buscar"
  accessibilityHint="Busca movimientos"
  onPress={openSearch}
/>
```

- `variant`: `ghost` (por defecto, transparente), `tonal` (tinte de `primary`), `filled` (`primary` sólido).
- `size`: `sm` (32), `md` (40, por defecto), `lg` (48). El área táctil siempre llega a `layout.minTouchTarget` (48) mediante `hitSlop`, sin importar el tamaño visible.
- Estados: pressed (fondo resaltado u opacidad en `filled`) y disabled (opacidad 0.4, sin `onPress`, `accessibilityState.disabled`).

## Agregar un icono

1. Elegir el glifo en [lucide.dev](https://lucide.dev/icons).
2. Importarlo en `iconRegistry.ts` por su ruta individual: `import Wallet from 'lucide-react-native/icons/wallet';`. No importar desde la raíz del paquete: Metro no hace tree-shaking y empaquetaría todos los iconos.
3. Agregar la entrada con un nombre semántico en la sección correspondiente.
4. Agregar el nombre a `EXPECTED_ICON_NAMES` en `__tests__/icons/iconRegistry.test.tsx`.

`IconName` se deriva del registro, así que el nuevo nombre queda disponible y tipado en toda la app.

## Convenciones de nombres

- camelCase y por **significado**, no por forma: `delete` (no `trash`), `transactions` (no `receiptText`), `bank` (no `landmark`). Así un glifo puede cambiar sin tocar pantallas.
- Un nombre por concepto. `home` sirve para la navegación y para la categoría de vivienda.
- Convención de movimientos: ingreso `arrowDown` (el dinero entra), gasto `arrowUp` (sale), transferencia `arrowLeftRight`. Definida en `features/transactions/components/transactionTypeVisuals.ts`.

## Accesibilidad

- `Icon` es **decorativo por defecto**: queda oculto para TalkBack/VoiceOver. Úsalo así cuando hay texto al lado que ya comunica el significado.
- Con `accessibilityLabel`, un `View` contenedor se anuncia una sola vez como imagen. No se pasan props de accesibilidad a Lucide porque las copia en cada trazo interno del SVG.
- `IconButton` exige `accessibilityLabel`, usa `accessibilityRole="button"` y comunica `disabled`.
- Las tabs usan iconos decorativos: el botón de la tab ya anuncia su etiqueta y su estado seleccionado.

## Relación con el Design System

- Colores: solo tokens de `ColorPalette`. Los tintes se derivan con `withAlpha`; no hay paleta paralela.
- Tamaños: `iconSize` e `iconStrokeWidth` en `shared/theme/iconography.ts`; touch target en `layout.minTouchTarget`.
- Light y dark mode vienen de `useAppTheme()`.

## Regla: no importar Lucide en pantallas

Solo `src/shared/icons/` puede importar `lucide-react-native`. ESLint lo impone con `no-restricted-imports` (`mobile/.eslintrc.js`): cualquier otro import falla el lint.

## Tests

En Jest, la condición de export `react-native` resolvería los iconos a archivos `.mjs` (ESM) que Jest no transforma. `jest.config.js` mapea `lucide-react-native/icons/*` al build CommonJS oficial del mismo paquete. Los tests renderizan el SVG real (sin mocks).
