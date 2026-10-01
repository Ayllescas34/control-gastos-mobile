import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useAppTheme } from '../theme';
import { Icon } from './Icon';
import { getToneColors, ICON_CONTAINER } from './iconTones';
import type { IconContainerSize, IconName, IconTone } from './iconTypes';

export type IconBadgeProps = {
  name: IconName;
  /** Color role. Defaults to `neutral`. */
  variant?: IconTone;
  /** Defaults to `md` (40). */
  size?: IconContainerSize;
  /** Set when the badge carries meaning not repeated in nearby text. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Icon inside a tinted container, e.g. the type of a transaction in a list row. */
export const IconBadge = memo(function IconBadgeView({
  name,
  variant = 'neutral',
  size = 'md',
  accessibilityLabel,
  style,
  testID,
}: IconBadgeProps) {
  const theme = useAppTheme();
  const { foreground, background } = getToneColors(variant, theme);
  const { box, icon } = ICON_CONTAINER[size];

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        { width: box, height: box, backgroundColor: background },
        style,
      ]}
    >
      <Icon
        name={name}
        size={icon}
        color={foreground}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.small,
  },
});
