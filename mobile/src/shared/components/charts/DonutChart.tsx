import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { spacing, useAppTheme } from '../../theme';
import { AppText } from '../AppText';
import { ChartLegend } from './ChartLegend';

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** Text shown in the legend ("Q 250.00 · 40%"). */
  display: string;
};

type DonutChartProps = {
  slices: readonly DonutSlice[];
  /** Total in the hole ("Q 625.00"). */
  centerValue: string;
  centerLabel: string;
  accessibilityLabel: string;
  testID?: string;
};

const SIZE = spacing.xxxl * 4;
const STROKE = spacing.xl;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between slices, in px along the ring. */
const GAP = 2;

/**
 * Parts of a whole as a ring. Colors come from the theme's categorical series in fixed
 * order, the last slice "Otros" in the neutral; the legend lists every value as text.
 */
export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  accessibilityLabel,
  testID,
}: DonutChartProps) {
  const theme = useAppTheme();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const colorOf = (slice: DonutSlice, index: number) =>
    slice.key === 'other'
      ? theme.chartOther
      : theme.chartSeries[index % theme.chartSeries.length];

  let start = 0;
  const arcs = slices.map((slice, index) => {
    const length = total > 0 ? (slice.value / total) * CIRCUMFERENCE : 0;
    const arc = {
      key: slice.key,
      color: colorOf(slice, index),
      dash: Math.max(length - (slices.length > 1 ? GAP : 0), 0),
      offset: -start,
    };
    start += length;
    return arc;
  });

  return (
    <View testID={testID} style={styles.container}>
      <View
        style={styles.ring}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={theme.colors.surfaceMuted}
            strokeWidth={STROKE}
            fill="none"
          />
          {arcs.map(arc => (
            <Circle
              key={arc.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={arc.offset}
              fill="none"
              // Start at 12 o'clock and go clockwise.
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <AppText variant="amount" numberOfLines={1} adjustsFontSizeToFit>
            {centerValue}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {centerLabel}
          </AppText>
        </View>
      </View>
      <ChartLegend
        entries={slices.map((slice, index) => ({
          key: slice.key,
          color: colorOf(slice, index),
          label: slice.label,
          value: slice.display,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  ring: {
    alignSelf: 'center',
    width: SIZE,
    height: SIZE,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: STROKE + spacing.sm,
  },
});
