import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../shared/components';
import { IconBadge, type IconName, type IconTone } from '../../../shared/icons';
import { formatMoney, type CurrencyCode } from '../../../shared/lib/money';
import { layout, spacing, type ColorName } from '../../../shared/theme';
import type { CurrencySummary } from '../domain/dashboardSummary';

type SummaryCardsProps = {
  summary: CurrencySummary;
  periodLabel: string;
};

/** Total balance of the active accounts, then the month's income and expenses. */
export function SummaryCards({ summary, periodLabel }: SummaryCardsProps) {
  const { currency, balanceMinor } = summary;
  const balance =
    balanceMinor === null ? null : formatMoney(balanceMinor, currency);

  return (
    <>
      <Card>
        <View
          testID={`dashboard-balance-${currency}`}
          accessible
          accessibilityLabel={
            balance === null
              ? `Balance total en ${currency}: sin cuentas activas`
              : `Balance total: ${balance}`
          }
        >
          <AppText variant="caption" color="textSecondary">
            Balance total
          </AppText>
          {balance === null ? (
            <AppText color="textSecondary">
              Sin cuentas activas en {currency}.
            </AppText>
          ) : (
            <AppText
              variant="amountHero"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {balance}
            </AppText>
          )}
          <AppText variant="caption" color="textSecondary">
            Saldo actual de tus cuentas activas
          </AppText>
        </View>
      </Card>

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          {periodLabel}
        </AppText>
        <PeriodRow
          testID={`dashboard-income-${currency}`}
          label="Ingresos del mes"
          icon="arrowDown"
          tone="income"
          color="income"
          amountMinor={summary.incomeMinor}
          currency={currency}
        />
        <PeriodRow
          testID={`dashboard-expense-${currency}`}
          label="Gastos del mes"
          icon="arrowUp"
          tone="expense"
          color="expense"
          amountMinor={summary.expenseMinor}
          currency={currency}
        />
      </Card>
    </>
  );
}

type PeriodRowProps = {
  testID: string;
  label: string;
  icon: IconName;
  tone: IconTone;
  color: ColorName;
  amountMinor: number;
  currency: CurrencyCode;
};

function PeriodRow({
  testID,
  label,
  icon,
  tone,
  color,
  amountMinor,
  currency,
}: PeriodRowProps) {
  const amount = formatMoney(amountMinor, currency);

  return (
    <View
      testID={testID}
      style={styles.row}
      accessible
      accessibilityLabel={`${label}: ${amount}`}
    >
      <IconBadge name={icon} variant={tone} size="sm" />
      <AppText style={styles.label}>{label}</AppText>
      <AppText
        variant="amountLarge"
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={styles.amount}
      >
        {amount}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.listItemGap,
    minHeight: layout.minTouchTarget,
    paddingVertical: spacing.xs,
  },
  label: {
    flexShrink: 1,
  },
  amount: {
    flex: 1,
    textAlign: 'right',
  },
});
