import {
  darkChartOther,
  darkChartSeries,
  darkColors,
  darkPrimaryGradient,
  lightChartOther,
  lightChartSeries,
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
  /** Categorical series for charts, in fixed order, and the neutral for "Otros". */
  chartSeries: readonly string[];
  chartOther: string;
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
  chartSeries: lightChartSeries,
  chartOther: lightChartOther,
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
  chartSeries: darkChartSeries,
  chartOther: darkChartOther,
  shadows: darkShadows,
  spacing,
  layout,
  radius,
  typography,
  iconSize,
  iconStrokeWidth,
};
