import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../shared/components';
import { formatLocalDate, localDatesBetween } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import type { LocalDateRange } from '../../transactions/data/transactionRepository';
import {
  radius,
  spacing,
  useAppTheme,
  type ColorName,
} from '../../../shared/theme';
import type { CurrencySummary, DayEvolution } from '../domain/dashboardSummary';

type EvolutionChartProps = {
  summary: CurrencySummary;
  period: LocalDateRange;
  periodLabel: string;
};

/** Plot height, on the spacing scale. */
const CHART_HEIGHT = spacing.xxxl * 3;
/** A non-zero day stays visible next to a much larger one (percent of the plot). */
const MIN_BAR_PERCENT = 2;

/**
 * Income and expenses per day of the month as paired bars built from plain Views (no chart
 * library). Days without movements are blank slots, never invented values. Bar heights are
 * presentation-only ratios; the figures themselves are in the summary above, so nothing
 * depends on reading the chart.
 */
export function EvolutionChart({
  summary,
  period,
  periodLabel,
}: EvolutionChartProps) {
  const theme = useAppTheme();
  const { currency, days } = summary;

  const dates = localDatesBetween(period.from, period.to);
  const byDate = new Map<string, DayEvolution>(
    days.map(day => [day.localDate, day]),
  );
  const max = Math.max(
    0,
    ...days.map(day => Math.max(day.incomeMinor, day.expenseMinor)),
  );
  const middle = dates[Math.floor((dates.length - 1) / 2)];

  const bar = (date: string, kind: 'income' | 'expense', valueMinor: number) =>
    valueMinor > 0 && (
      <View
        testID={`dashboard-evolution-${kind}-${date}`}
        style={[
          styles.bar,
          {
            height: `${Math.max((valueMinor / max) * 100, MIN_BAR_PERCENT)}%`,
            backgroundColor: theme.colors[kind],
          },
        ]}
      />
    );

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        Evolución
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Ingresos y gastos por día · {periodLabel}
      </AppText>

      {days.length === 0 ? (
        <AppText color="textSecondary" style={styles.empty}>
          Sin ingresos ni gastos este mes.
        </AppText>
      ) : (
        <View
          testID={`dashboard-evolution-${currency}`}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Evolución de ingresos y gastos del mes actual, ${periodLabel}: ${
            days.length
          } ${
            days.length === 1 ? 'día' : 'días'
          } con movimientos, ingresos ${formatMoney(
            summary.incomeMinor,
            currency,
          )}, gastos ${formatMoney(summary.expenseMinor, currency)}.`}
          style={styles.chart}
        >
          <View style={styles.legend}>
            <LegendItem color="income" label="Ingresos" />
            <LegendItem color="expense" label="Gastos" />
          </View>

          <View
            style={[styles.plot, { borderBottomColor: theme.colors.border }]}
          >
            {dates.map(date => {
              const day = byDate.get(date);
              return (
                <View key={date} style={styles.slot}>
                  {day && bar(date, 'income', day.incomeMinor)}
                  {day && bar(date, 'expense', day.expenseMinor)}
                </View>
              );
            })}
          </View>

          <View style={styles.axis}>
            {[dates[0], middle, dates[dates.length - 1]].map(date => (
              <AppText key={date} variant="caption" color="textSecondary">
                {formatLocalDate(date, 'd MMM')}
              </AppText>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

function LegendItem({ color, label }: { color: ColorName; label: string }) {
  const theme = useAppTheme();

  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: theme.colors[color] }]} />
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: spacing.lg,
  },
  chart: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatch: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  slot: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xxs / 2,
  },
  bar: {
    flex: 1,
    maxWidth: spacing.xs,
    borderTopLeftRadius: radius.chartBar,
    borderTopRightRadius: radius.chartBar,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
