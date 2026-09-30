import { darkColors, lightColors, type ColorPalette } from './colors';
import { radius, spacing } from './spacing';
import { typography } from './typography';

export type AppTheme = {
  dark: boolean;
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
};
