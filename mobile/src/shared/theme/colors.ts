export type ColorPalette = {
  background: string;
  surface: string;
  /** Chips, inputs and icon backgrounds. */
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  income: string;
  expense: string;
  transfer: string;
  error: string;
  warning: string;
  success: string;
  /** Text and icons over featured gradient surfaces (balance hero, wallet cards). */
  onFeatured: string;
  onFeaturedMuted: string;
};

export type ColorName = keyof ColorPalette;

/** Text colors for income/expense stay dark enough for AA contrast on white surfaces. */
export const lightColors: ColorPalette = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F6',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  primary: '#1A73E8',
  onPrimary: '#FFFFFF',
  secondary: '#0F766E',
  income: '#15803D',
  expense: '#B91C1C',
  transfer: '#6D28D9',
  error: '#DC2626',
  warning: '#B45309',
  success: '#15803D',
  onFeatured: '#FFFFFF',
  onFeaturedMuted: 'rgba(255, 255, 255, 0.78)',
};

export const darkColors: ColorPalette = {
  background: '#0B1120',
  surface: '#111827',
  surfaceMuted: '#1F2937',
  border: '#1E293B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#8AB4F8',
  onPrimary: '#0B1120',
  secondary: '#2DD4BF',
  income: '#4ADE80',
  expense: '#F87171',
  transfer: '#A78BFA',
  error: '#FB7185',
  warning: '#FBBF24',
  success: '#4ADE80',
  onFeatured: '#FFFFFF',
  onFeaturedMuted: 'rgba(255, 255, 255, 0.78)',
};

/** Featured surfaces (e.g. the balance card). Native `backgroundImage`, no gradient library. */
export const lightPrimaryGradient = 'linear-gradient(135deg, #0B3D91, #1A73E8)';
export const darkPrimaryGradient = 'linear-gradient(135deg, #0B2A66, #1A56C4)';

export type WalletCardTone =
  | 'blue'
  | 'violet'
  | 'teal'
  | 'orange'
  | 'graphite';

/**
 * Wallet card faces: a gradient plus a solid fallback of the same hue (shown where
 * `backgroundImage` is not rendered). White text keeps AA contrast on every one.
 */
export const walletCardFaces: Record<
  WalletCardTone,
  { gradient: string; solid: string }
> = {
  blue: { gradient: 'linear-gradient(135deg, #1A73E8, #0B3D91)', solid: '#1557B0' },
  violet: { gradient: 'linear-gradient(135deg, #7C3AED, #312E81)', solid: '#5B21B6' },
  teal: { gradient: 'linear-gradient(135deg, #0F766E, #064E3B)', solid: '#0F5F57' },
  orange: { gradient: 'linear-gradient(135deg, #C2410C, #7C2D12)', solid: '#9A3412' },
  graphite: { gradient: 'linear-gradient(135deg, #334155, #0F172A)', solid: '#1E293B' },
};
