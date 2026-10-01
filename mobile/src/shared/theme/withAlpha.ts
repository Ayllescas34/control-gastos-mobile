const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Translucent variant of a palette color (e.g. tinted badge backgrounds), so tints are
 * derived from existing tokens instead of a parallel palette. Expects `#RRGGBB`.
 */
export function withAlpha(hexColor: string, alpha: number): string {
  if (!HEX_COLOR.test(hexColor)) {
    throw new Error(
      `withAlpha expects a #RRGGBB color, received "${hexColor}"`,
    );
  }
  const clamped = Math.min(1, Math.max(0, alpha));
  const channel = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hexColor}${channel}`;
}
