import type { ViewStyle } from 'react-native';

export type ShadowLevel = 'none' | 'sm' | 'md';

export type Shadows = Record<ShadowLevel, Pick<ViewStyle, 'boxShadow'>>;

/** Native `boxShadow` (React Native New Architecture): soft blur on Android too, unlike elevation. */
export const lightShadows: Shadows = {
  none: {},
  sm: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)' },
  // Tinted with primary (#2563EB) at 20%.
  md: { boxShadow: '0px 8px 24px rgba(37, 99, 235, 0.2)' },
};

/** Dark mode separates layers with surface colors, not shadows. */
export const darkShadows: Shadows = {
  none: {},
  sm: {},
  md: {},
};
