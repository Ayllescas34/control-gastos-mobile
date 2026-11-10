import {
  darkColors,
  darkPrimaryGradient,
  lightColors,
  lightPrimaryGradient,
  walletCardFaces,
  type ColorPalette,
} from './colors';
import { iconSize, iconStrokeWidth } from './iconography';
import { darkShadows, lightShadows, type Shadows } from './shadows';
import { layout, radius, spacing } from './spacing';
import { typography } from './typography';

export type AppTheme = {
  dark: boolean;
  colors: ColorPalette;
  /** CSS linear-gradient for the native `backgroundImage` style. */
  primaryGradient: string;
  /** Faces of the wallet cards (accounts on Inicio). Same in light and dark. */
  walletCardFaces: typeof walletCardFaces;
  shadows: Shadows;
  spacing: typeof spacing;
  layout: typeof layout;
  radius: typeof radius;
  typography: typeof typography;
  iconSize: typeof iconSize;
  iconStrokeWidth: number;
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
  primaryGradient: lightPrimaryGradient,
  walletCardFaces,
  shadows: lightShadows,
  spacing,
  layout,
  radius,
  typography,
  iconSize,
  iconStrokeWidth,
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: darkColors,
  primaryGradient: darkPrimaryGradient,
  walletCardFaces,
  shadows: darkShadows,
  spacing,
  layout,
  radius,
  typography,
  iconSize,
  iconStrokeWidth,
};
