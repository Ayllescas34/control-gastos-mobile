import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../shared/components';
import { IconBadge, type IconName, type IconTone } from '../../../shared/icons';
import { formatMoney, type CurrencyCode } from '../../../shared/lib/money';
import {
  layout,
  radius,
  spacing,
  useAppTheme,
  type ColorName,
} from '../../../shared/theme';
import type { CurrencySummary } from '../domain/dashboardSummary';

type SummaryCardsProps = {
  summary: CurrencySummary;
  periodLabel: string;
};

/** Total balance of the active accounts, then the month's income and expenses. */
export function SummaryCards({ summary, periodLabel }: SummaryCardsProps) {
  const theme = useAppTheme();
  const { currency, balanceMinor } = summary;
  const balance =
    balanceMinor === null ? null : formatMoney(balanceMinor, currency);

  return (
    <>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.walletCardFaces.blue.solid,
            backgroundImage: theme.primaryGradient,
          },
          theme.shadows.md,
        ]}
      >
        <View
          testID={`dashboard-balance-${currency}`}
          accessible
          accessibilityLabel={
            balance === null
              ? `Balance total en ${currency}: sin cuentas activas`
              : `Balance total: ${balance}`
          }
        >
          <AppText variant="label" color="onFeaturedMuted">
            Balance total
          </AppText>
          {balance === null ? (
            <AppText color="onFeatured">
              Sin cuentas activas en {currency}.
            </AppText>
          ) : (
            <AppText
              variant="amountHero"
              color="onFeatured"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {balance}
            </AppText>
          )}
          <AppText variant="caption" color="onFeaturedMuted">
            Saldo actual de tus cuentas activas
          </AppText>
        </View>
      </View>

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
  hero: {
    borderRadius: radius.cardFeatured,
    padding: layout.cardPadding,
    gap: spacing.xs,
  },
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
