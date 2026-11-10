import { StyleSheet, View } from 'react-native';
import { radius, spacing } from '../../theme';
import { AppText } from '../AppText';

type LegendEntry = { key: string; color: string; label: string; value?: string };

/**
 * Legend that doubles as the table view: each series' swatch, name and (optionally) value
 * as text, so no chart is read by color alone.
 */
export function ChartLegend({
  entries,
  inline = false,
}: {
  entries: readonly LegendEntry[];
  /** One row (short legends without values). */
  inline?: boolean;
}) {
  return (
    <View style={[styles.legend, inline && styles.inline]}>
      {entries.map(entry => (
        <View
          key={entry.key}
          style={styles.row}
          accessible
          accessibilityLabel={
            entry.value ? `${entry.label}: ${entry.value}` : entry.label
          }
        >
          <View style={[styles.swatch, { backgroundColor: entry.color }]} />
          <AppText
            variant="label"
            style={!inline && styles.label}
            numberOfLines={1}
          >
            {entry.label}
          </AppText>
          {entry.value !== undefined && (
            <AppText variant="amount">{entry.value}</AppText>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    gap: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.chartBar / 2,
  },
  label: {
    flex: 1,
  },
});
