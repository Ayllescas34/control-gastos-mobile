import {
  darkColors,
  darkPrimaryGradient,
  lightColors,
  lightPrimaryGradient,
  type ColorPalette,
} from './colors';
import { darkShadows, lightShadows, type Shadows } from './shadows';
import { layout, radius, spacing } from './spacing';
import { typography } from './typography';

export type AppTheme = {
  dark: boolean;
  colors: ColorPalette;
  /** CSS linear-gradient for the native `backgroundImage` style. */
  primaryGradient: string;
  shadows: Shadows;
  spacing: typeof spacing;
  layout: typeof layout;
  radius: typeof radius;
  typography: typeof typography;
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
  primaryGradient: lightPrimaryGradient,
  shadows: lightShadows,
  spacing,
  layout,
  radius,
  typography,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: darkColors,
  primaryGradient: darkPrimaryGradient,
  shadows: darkShadows,
  spacing,
  layout,
  radius,
  typography,
};
