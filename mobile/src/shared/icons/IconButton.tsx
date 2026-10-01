import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  layout,
  radius,
  useAppTheme,
  type AppTheme,
  type ColorName,
} from '../theme';
import { Icon } from './Icon';
import { getToneColors, ICON_CONTAINER } from './iconTones';
import type { IconContainerSize, IconName } from './iconTypes';

export type IconButtonVariant = 'ghost' | 'tonal' | 'filled';

export type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /** Required: an icon alone has no text for screen readers. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Visible size. The touch target is always at least `layout.minTouchTarget`. */
  size?: IconContainerSize;
  variant?: IconButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DISABLED_OPACITY = 0.4;
const FILLED_PRESSED_OPACITY = 0.85;

type VariantColors = {
  foreground: ColorName;
  background: string;
  pressedBackground: string;
};

function getVariantColors(
  variant: IconButtonVariant,
  theme: AppTheme,
): VariantColors {
  switch (variant) {
    case 'filled':
      return {
        foreground: 'onPrimary',
        background: theme.colors.primary,
        pressedBackground: theme.colors.primary,
      };
    case 'tonal':
      return getToneColors('primary', theme);
    case 'ghost':
      return {
        foreground: 'textPrimary',
        background: 'transparent',
        pressedBackground: theme.colors.surfaceMuted,
      };
  }
}

/** Extends the touchable area around small buttons up to the minimum touch target. */
function touchSlop(box: number): Insets | undefined {
  const extra = Math.max(0, (layout.minTouchTarget - box) / 2);
  return extra > 0
    ? { top: extra, bottom: extra, left: extra, right: extra }
    : undefined;
}

/** Icon-only action. Accessible as a button, with pressed and disabled states. */
export const IconButton = memo(function IconButtonView({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 'md',
  variant = 'ghost',
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const theme = useAppTheme();
  const colors = getVariantColors(variant, theme);
  const { box, icon: iconSize } = ICON_CONTAINER[size];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      hitSlop={touchSlop(box)}
      style={({ pressed }) => [
        styles.button,
        {
          width: box,
          height: box,
          backgroundColor:
            pressed && variant !== 'filled'
              ? colors.pressedBackground
              : colors.background,
          opacity: disabled
            ? DISABLED_OPACITY
            : pressed && variant === 'filled'
            ? FILLED_PRESSED_OPACITY
            : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={colors.foreground} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
