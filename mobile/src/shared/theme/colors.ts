export type ColorPalette = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  income: string;
  expense: string;
  demoBackground: string;
  demoText: string;
};

export type ColorName = keyof ColorPalette;

export const lightColors: ColorPalette = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  income: '#15803D',
  expense: '#B91C1C',
  demoBackground: '#FEF3C7',
  demoText: '#92400E',
};

export const darkColors: ColorPalette = {
  background: '#0B0F14',
  surface: '#151B23',
  border: '#1F2937',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  primary: '#2DD4BF',
  onPrimary: '#042F2E',
  income: '#4ADE80',
  expense: '#F87171',
  demoBackground: '#3A2E0A',
  demoText: '#FCD34D',
};
