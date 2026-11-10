import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';
import { radius, spacing, useAppTheme } from '../../theme';
import { AppText } from '../AppText';
import { ChartLegend } from './ChartLegend';

export type PairedBarGroup = {
  key: string;
  /** Under the group ("oct"). */
  label: string;
  /** Spoken and shown when the group is selected ("octubre 2026"). */
  longLabel: string;
  first: number;
  second: number;
  firstDisplay: string;
  secondDisplay: string;
};

type PairedBarChartProps = {
  groups: readonly PairedBarGroup[];
  firstLabel: string;
  secondLabel: string;
  firstColor: string;
  secondColor: string;
  testID?: string;
};

const PLOT_HEIGHT = spacing.xxxl * 3;
const MIN_BAR_PERCENT = 2;

/**
 * Two bars per group (income and expense per month) from plain Views. Tapping a group shows
 * its exact figures under the chart; the last group is selected to begin with.
 */
export function PairedBarChart({
  groups,
  firstLabel,
  secondLabel,
  firstColor,
  secondColor,
  testID = 'paired-bars',
}: PairedBarChartProps) {
  const theme = useAppTheme();
  const [selectedKey, setSelectedKey] = useState(groups.at(-1)?.key);
  const selected = groups.find(group => group.key === selectedKey) ?? groups.at(-1);
  const max = Math.max(0, ...groups.flatMap(group => [group.first, group.second]));

  const bar = (value: number, color: string) => {
    const height: DimensionValue =
      value > 0 && max > 0
        ? `${Math.max((value / max) * 100, MIN_BAR_PERCENT)}%`
        : 0;
    return <View style={[styles.bar, { height, backgroundColor: color }]} />;
  };

  return (
    <View testID={testID} style={styles.container}>
      <ChartLegend
        inline
        entries={[
          { key: 'first', color: firstColor, label: firstLabel },
          { key: 'second', color: secondColor, label: secondLabel },
        ]}
      />
      <View style={[styles.plot, { borderBottomColor: theme.colors.border }]}>
        {groups.map(group => {
          const isSelected = group.key === selected?.key;
          return (
            <Pressable
              key={group.key}
              testID={`${testID}-${group.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${group.longLabel}: ${firstLabel} ${group.firstDisplay}, ${secondLabel} ${group.secondDisplay}`}
              onPress={() => setSelectedKey(group.key)}
              style={[
                styles.group,
                isSelected && { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <View style={styles.bars}>
                {bar(group.first, firstColor)}
                {bar(group.second, secondColor)}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {groups.map(group => (
          <AppText
            key={group.key}
            variant="caption"
            color={group.key === selected?.key ? 'textPrimary' : 'textSecondary'}
            style={styles.axisLabel}
          >
            {group.label}
          </AppText>
        ))}
      </View>
      {selected && (
        <View style={styles.detail} accessibilityLiveRegion="polite">
          <AppText variant="label" color="textSecondary">
            {selected.longLabel}
          </AppText>
          <AppText variant="caption">
            {firstLabel}: {selected.firstDisplay} · {secondLabel}:{' '}
            {selected.secondDisplay}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  plot: {
    height: PLOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  group: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    borderTopLeftRadius: radius.chartBar,
    borderTopRightRadius: radius.chartBar,
    paddingHorizontal: spacing.xxs,
  },
  bars: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    // The 2px surface gap between the pair.
    gap: 2,
  },
  bar: {
    flex: 1,
    maxWidth: spacing.lg,
    borderTopLeftRadius: radius.chartBar / 1.5,
    borderTopRightRadius: radius.chartBar / 1.5,
  },
  axis: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
  },
  detail: {
    gap: spacing.xxs,
  },
});
