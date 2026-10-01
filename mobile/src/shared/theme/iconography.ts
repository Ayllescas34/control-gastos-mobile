/** Icon glyph sizes. Containers (badges, buttons) size themselves around these. */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSizeToken = keyof typeof iconSize;

/** One stroke weight for every icon keeps the set visually consistent. */
export const iconStrokeWidth = 2;
