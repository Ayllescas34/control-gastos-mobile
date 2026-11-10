import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { spacing, useAppTheme, withAlpha } from '../../theme';

export type LinePoint = { key: string; value: number };

type LineChartProps = {
  points: readonly LinePoint[];
  color: string;
  accessibilityLabel: string;
  testID?: string;
};

const HEIGHT = spacing.xxxl * 3;
const PADDING = spacing.sm;
/** Smallest vertical range, as a share of the largest absolute value. */
const MIN_SPAN_RATIO = 0.1;
/** End marker: at least 8px. */
const MARKER = 5;

/**
 * One series over time: a 2px line with a soft area under it and a marker on the latest
 * point. One axis only; a dashed zero line appears when the values cross it (debt). The
 * figures themselves are shown as text by the screen, next to the chart.
 */
export function LineChart({
  points,
  color,
  accessibilityLabel,
  testID = 'line-chart',
}: LineChartProps) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);
  const values = points.map(point => point.value);
  // A line is read by its shape, so the scale need not start at zero; but it spans at least
  // MIN_SPAN_RATIO of the largest value, so Q28 on a Q23,000 balance does not look like a
  // cliff.
  const low = Math.min(...values);
  const high = Math.max(...values);
  const floorSpan = Math.max(Math.abs(low), Math.abs(high)) * MIN_SPAN_RATIO;
  const pad = Math.max(0, floorSpan - (high - low)) / 2;
  const min = low - pad;
  const max = high + pad;
  const span = max - min;

  const x = (index: number) =>
    points.length <= 1
      ? width / 2
      : PADDING + (index / (points.length - 1)) * (width - PADDING * 2);
  const y = (value: number) =>
    span === 0
      ? HEIGHT / 2
      : PADDING + (1 - (value - min) / span) * (HEIGHT - PADDING * 2);

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`)
    .join(' ');
  const crossesZero = min < 0 && max > 0;
  const baseline = crossesZero ? y(0) : HEIGHT - PADDING;
  const area =
    points.length > 0
      ? `${line} L${x(points.length - 1)},${baseline} L${x(0)},${baseline} Z`
      : '';
  const last = points.length - 1;

  return (
    <View
      testID={testID}
      style={styles.plot}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 && points.length > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line
            x1={PADDING}
            x2={width - PADDING}
            y1={HEIGHT - PADDING}
            y2={HEIGHT - PADDING}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
          {crossesZero && (
            <Line
              x1={PADDING}
              x2={width - PADDING}
              y1={y(0)}
              y2={y(0)}
              stroke={theme.colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          <Path d={area} fill={withAlpha(color, 0.12)} />
          <Path
            d={line}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={x(last)}
            cy={y(points[last].value)}
            r={MARKER}
            fill={color}
            stroke={theme.colors.surface}
            strokeWidth={2}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    height: HEIGHT,
  },
});
