/** 4-point scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Recurring layout distances, so screens share the same rhythm. */
export const layout = {
  screenPadding: 20,
  cardPadding: 20,
  sectionGap: 24,
  listItemGap: 12,
  /** Minimum touch target (Material 48dp), independent of the visible size. */
  minTouchTarget: 48,
} as const;

export const radius = {
  cardFeatured: 24,
  card: 20,
  button: 14,
  input: 12,
  small: 10,
  chartBar: 6,
  /** Chips, badges and circular elements. */
  pill: 999,
} as const;
