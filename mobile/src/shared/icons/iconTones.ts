import {
  withAlpha,
  type AppTheme,
  type ColorName,
  type IconSizeToken,
} from '../theme';
import type { IconContainerSize, IconTone } from './iconTypes';

/** Glyph color per tone. Neutral uses secondary text for a quieter look. */
const TONE_FOREGROUND: Record<IconTone, ColorName> = {
  primary: 'primary',
  income: 'income',
  expense: 'expense',
  transfer: 'transfer',
  neutral: 'textSecondary',
  warning: 'warning',
  error: 'error',
};

/** Tint strength over the surface. Dark surfaces need a stronger tint to read. */
const TINT_ALPHA = { light: 0.12, dark: 0.2 } as const;
const PRESSED_TINT_ALPHA = { light: 0.2, dark: 0.3 } as const;

export type ToneColors = {
  foreground: ColorName;
  /** Tinted background derived from the tone color, never a new palette color. */
  background: string;
  pressedBackground: string;
};

export function getToneColors(tone: IconTone, theme: AppTheme): ToneColors {
  const foreground = TONE_FOREGROUND[tone];
  if (tone === 'neutral') {
    return {
      foreground,
      background: theme.colors.surfaceMuted,
      pressedBackground: theme.colors.border,
    };
  }
  const mode = theme.dark ? 'dark' : 'light';
  const color = theme.colors[foreground];
  return {
    foreground,
    background: withAlpha(color, TINT_ALPHA[mode]),
    pressedBackground: withAlpha(color, PRESSED_TINT_ALPHA[mode]),
  };
}

/** Visible container size and the glyph size it holds. */
export const ICON_CONTAINER: Record<
  IconContainerSize,
  { box: number; icon: IconSizeToken }
> = {
  sm: { box: 32, icon: 'sm' },
  md: { box: 40, icon: 'md' },
  lg: { box: 48, icon: 'lg' },
};
