import type { TextStyle } from 'react-native';

/** Equal-width digits so amounts align in lists and do not jitter when they change. */
const tabularNums: TextStyle['fontVariant'] = ['tabular-nums'];

/** System fonts only (Roboto on Android, San Francisco on iOS). */
export const typography = {
  amountHero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    fontVariant: tabularNums,
  },
  amountLarge: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: tabularNums,
  },
  amount: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    fontVariant: tabularNums,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
