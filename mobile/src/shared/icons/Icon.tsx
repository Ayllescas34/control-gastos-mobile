import { memo } from 'react';
import { View } from 'react-native';
import { useAppTheme, type AppTheme } from '../theme';
import { iconRegistry } from './iconRegistry';
import type { IconProps, IconSize } from './iconTypes';

function resolveIconSize(size: IconSize, theme: AppTheme): number {
  return typeof size === 'number' ? size : theme.iconSize[size];
}

/**
 * The only way screens render icons: `<Icon name="home" />`. Resolves the semantic name
 * through iconRegistry and styles it with theme tokens.
 *
 * Accessibility: decorative by default (hidden from screen readers). With
 * `accessibilityLabel`, a wrapper View carries the semantics so it is announced once:
 * Lucide copies extra props onto every inner SVG path, so they are not passed to it.
 */
export const Icon = memo(function IconView({
  name,
  size = 'md',
  color = 'textPrimary',
  strokeWidth,
  accessibilityLabel,
  style,
  testID,
}: IconProps) {
  const theme = useAppTheme();
  const Glyph = iconRegistry[name];
  const isLabelled = accessibilityLabel !== undefined;

  const glyph = (
    <Glyph
      size={resolveIconSize(size, theme)}
      color={theme.colors[color]}
      strokeWidth={strokeWidth ?? theme.iconStrokeWidth}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={isLabelled ? undefined : style}
      testID={isLabelled ? undefined : testID}
    />
  );

  if (!isLabelled) {
    return glyph;
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={style}
      testID={testID}
    >
      {glyph}
    </View>
  );
});
