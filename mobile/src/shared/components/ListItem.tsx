import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../icons';
import { layout, radius, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Usually an IconBadge. Decorative: the title describes the row. */
  leading?: ReactNode;
  /** Right-aligned content such as an amount. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Defaults to "title, subtitle". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/** A row in a list. Pressable rows show a chevron and are announced as buttons. */
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListItemProps) {
  const theme = useAppTheme();
  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle !== undefined && (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {trailing}
      {onPress && <Icon name="chevronRight" size="md" color="textSecondary" />}
    </>
  );
  const label =
    accessibilityLabel ??
    (subtitle === undefined ? title : `${title}, ${subtitle}`);

  if (!onPress) {
    return (
      <View
        testID={testID}
        style={styles.row}
        accessible
        accessibilityLabel={label}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.listItemGap,
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.input,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
});
