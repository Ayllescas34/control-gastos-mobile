import type { StyleProp, ViewStyle } from 'react-native';
import type { ColorName, IconSizeToken } from '../theme';
import type { iconRegistry } from './iconRegistry';

/** Every icon the app can show. Extend it by adding an entry to iconRegistry. */
export type IconName = keyof typeof iconRegistry;

/** A size token from the theme, or explicit pixels for one-off layouts. */
export type IconSize = IconSizeToken | number;

/** Color roles shared by IconBadge and IconButton, mapped to theme tokens. */
export type IconTone =
  | 'primary'
  | 'income'
  | 'expense'
  | 'transfer'
  | 'neutral'
  | 'warning';

/** Container sizes for IconBadge and IconButton. */
export type IconContainerSize = 'sm' | 'md' | 'lg';

export type IconProps = {
  name: IconName;
  /** Defaults to `md`. */
  size?: IconSize;
  /** Theme color token, never a raw color. Defaults to `textPrimary`. */
  color?: ColorName;
  /** Defaults to the theme stroke width. */
  strokeWidth?: number;
  /**
   * Makes the icon meaningful to screen readers. Without it the icon is decorative
   * and hidden from accessibility services.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
