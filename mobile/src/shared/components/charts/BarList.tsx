import { StyleSheet, View, type DimensionValue } from 'react-native';
import { radius, spacing, useAppTheme } from '../../theme';
import { AppText } from '../AppText';

export type BarListItem = {
  key: string;
  label: string;
  value: number;
  display: string;
};

type BarListProps = {
  items: readonly BarListItem[];
  /** One hue for every bar: they compare magnitudes of the same measure. */
  color: string;
  testID?: string;
};

/** Horizontal bars ranked largest first, each with its name and amount as text. */
export function BarList({ items, color, testID = 'bar-list' }: BarListProps) {
  const theme = useAppTheme();
  const max = Math.max(0, ...items.map(item => item.value));

  return (
    <View testID={testID} style={styles.list}>
      {items.map(item => {
        const width: DimensionValue =
          max > 0 ? `${Math.max((item.value / max) * 100, 2)}%` : 0;
        return (
        <View
          key={item.key}
          style={styles.item}
          accessible
          accessibilityLabel={`${item.label}: ${item.display}`}
        >
          <View style={styles.row}>
            <AppText variant="label" style={styles.label} numberOfLines={1}>
              {item.label}
            </AppText>
            <AppText variant="amount">{item.display}</AppText>
          </View>
          <View
            style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}
          >
            <View style={[styles.fill, { width, backgroundColor: color }]} />
          </View>
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  item: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  track: {
    height: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
