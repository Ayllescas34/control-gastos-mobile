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
  demoBackground: string;
  demoText: string;
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
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  secondary: '#0F766E',
  income: '#15803D',
  expense: '#B91C1C',
  transfer: '#6D28D9',
  error: '#DC2626',
  warning: '#B45309',
  success: '#15803D',
  demoBackground: '#FEF3C7',
  demoText: '#92400E',
};

export const darkColors: ColorPalette = {
  background: '#0B1120',
  surface: '#111827',
  surfaceMuted: '#1F2937',
  border: '#1E293B',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#60A5FA',
  onPrimary: '#0B1120',
  secondary: '#2DD4BF',
  income: '#4ADE80',
  expense: '#F87171',
  transfer: '#A78BFA',
  error: '#FB7185',
  warning: '#FBBF24',
  success: '#4ADE80',
  demoBackground: '#3A2E0A',
  demoText: '#FCD34D',
};

/** Featured surfaces (e.g. the balance card). Native `backgroundImage`, no gradient library. */
export const lightPrimaryGradient = 'linear-gradient(135deg, #1E3A8A, #2563EB)';
export const darkPrimaryGradient = 'linear-gradient(135deg, #1E3A8A, #1D4ED8)';
