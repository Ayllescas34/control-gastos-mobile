import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../shared/components';
import {
  BarList,
  DonutChart,
  LineChart,
  PairedBarChart,
} from '../../../shared/components/charts';
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import { spacing, useAppTheme } from '../../../shared/theme';
import type { CurrencyInsights } from '../hooks/loadInsights';

type CardProps = {
  insights: CurrencyInsights;
  /** Prefix of the testIDs, per screen. */
  testIDPrefix: string;
};

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        {subtitle}
      </AppText>
    </View>
  );
}

/** Income vs expenses of the last six months; tap a month for its figures. */
export function TrendCard({ insights, testIDPrefix }: CardProps) {
  const theme = useAppTheme();
  const { currency, trend } = insights;
  if (trend.every(month => month.incomeMinor === 0 && month.expenseMinor === 0)) {
    return null;
  }
  return (
    <Card style={styles.card}>
      <Header
        title="Últimos 6 meses"
        subtitle="Ingresos y gastos por mes. Toca un mes para ver sus cifras."
      />
      <PairedBarChart
        testID={`${testIDPrefix}-trend-${currency}`}
        firstLabel="Ingresos"
        secondLabel="Gastos"
        firstColor={theme.colors.income}
        secondColor={theme.colors.expense}
        groups={trend.map(month => ({
          key: month.month,
          label: formatLocalDate(month.month, 'MMM'),
          longLabel: formatLocalDate(month.month, "MMMM 'de' yyyy"),
          first: month.incomeMinor,
          second: month.expenseMinor,
          firstDisplay: formatMoney(month.incomeMinor, currency),
          secondDisplay: formatMoney(month.expenseMinor, currency),
        }))}
      />
    </Card>
  );
}

/** Where the month's money went, as a ring; the category list below has the amounts. */
export function CategoryDonutCard({ insights, testIDPrefix }: CardProps) {
  const { currency, byCategory } = insights;
  const total = byCategory.reduce((sum, slice) => sum + slice.valueMinor, 0);
  if (total === 0) {
    return null;
  }
  const percent = (value: number) => `${Math.round((value / total) * 100)}%`;
  return (
    <Card style={styles.card}>
      <Header
        title="¿En qué se va tu dinero?"
        subtitle="Gastos del mes por categoría"
      />
      <DonutChart
        testID={`${testIDPrefix}-donut-${currency}`}
        centerValue={formatMoney(total, currency)}
        centerLabel="gastado"
        accessibilityLabel={`Gastos por categoría: ${byCategory
          .map(slice => `${slice.label} ${percent(slice.valueMinor)}`)
          .join(', ')}`}
        slices={byCategory.map(slice => ({
          key: slice.key,
          label: slice.label,
          value: slice.valueMinor,
          display: `${formatMoney(slice.valueMinor, currency)} · ${percent(
            slice.valueMinor,
          )}`,
        }))}
      />
    </Card>
  );
}

/** Total balance at the end of each day of the month, with the figures that matter as text. */
export function BalanceTrendCard({ insights, testIDPrefix }: CardProps) {
  const theme = useAppTheme();
  const { currency, balance } = insights;
  if (balance.length < 2) {
    return null;
  }
  const first = balance[0];
  const last = balance[balance.length - 1];
  const lowest = balance.reduce((low, point) =>
    point.balanceMinor < low.balanceMinor ? point : low,
  );
  const change = last.balanceMinor - first.balanceMinor;
  const day = (date: string) => formatLocalDate(date, "d 'de' MMM");
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return (
    <Card style={styles.card}>
      <Header
        title="Evolución del saldo"
        subtitle="Saldo total al final de cada día"
      />
      <LineChart
        testID={`${testIDPrefix}-balance-${currency}`}
        color={theme.colors.primary}
        accessibilityLabel={`Saldo del ${day(first.localDate)} al ${day(
          last.localDate,
        )}: de ${formatMoney(first.balanceMinor, currency)} a ${formatMoney(
          last.balanceMinor,
          currency,
        )}`}
        points={balance.map(point => ({
          key: point.localDate,
          value: point.balanceMinor,
        }))}
      />
      <View style={styles.figures}>
        <Figure
          label={`Hoy · ${formatLocalDate(last.localDate, 'd MMM')}`}
          value={formatMoney(last.balanceMinor, currency)}
        />
        <Figure
          label="Cambio del mes"
          value={`${sign}${formatMoney(Math.abs(change), currency)}`}
        />
        <Figure
          label={`Mínimo · ${formatLocalDate(lowest.localDate, 'd MMM')}`}
          value={formatMoney(lowest.balanceMinor, currency)}
        />
      </View>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="amount" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

/** How much went out through each account or card this month. */
export function AccountSpendingCard({ insights, testIDPrefix }: CardProps) {
  const theme = useAppTheme();
  const { currency, byAccount } = insights;
  if (byAccount.length === 0) {
    return null;
  }
  return (
    <Card style={styles.card}>
      <Header
        title="Gasto por cuenta o tarjeta"
        subtitle="Cuánto salió por cada una este mes"
      />
      <BarList
        testID={`${testIDPrefix}-by-account-${currency}`}
        color={theme.colors.expense}
        items={byAccount.map(slice => ({
          key: slice.key,
          label: slice.label,
          value: slice.valueMinor,
          display: formatMoney(slice.valueMinor, currency),
        }))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xxs,
  },
  figures: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  figure: {
    flex: 1,
    gap: spacing.xxs,
  },
});
