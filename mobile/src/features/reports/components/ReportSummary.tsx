import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../shared/components';
import { IconBadge, type IconName, type IconTone } from '../../../shared/icons';
import { formatMoney, type CurrencyCode } from '../../../shared/lib/money';
import { layout, spacing, type ColorName } from '../../../shared/theme';
import type { CurrencyReport } from '../domain/monthlyReport';
import { formatMovementCount } from './reportPresentation';

type ReportSummaryProps = {
  report: CurrencyReport;
};

/** The period's income, expenses (with how many movements each) and their net balance. */
export function ReportSummary({ report }: ReportSummaryProps) {
  const { currency, netMinor } = report;
  const net = formatMoney(netMinor, currency);

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        Resumen
      </AppText>
      <SummaryRow
        testID={`reports-income-${currency}`}
        label="Ingresos"
        icon="arrowDown"
        tone="income"
        color="income"
        amountMinor={report.incomeMinor}
        count={report.incomeCount}
        currency={currency}
      />
      <SummaryRow
        testID={`reports-expense-${currency}`}
        label="Gastos"
        icon="arrowUp"
        tone="expense"
        color="expense"
        amountMinor={report.expenseMinor}
        count={report.expenseCount}
        currency={currency}
      />
      <View
        testID={`reports-net-${currency}`}
        style={styles.row}
        accessible
        accessibilityLabel={`Balance del mes: ${net}`}
      >
        <IconBadge name="wallet" variant="primary" size="sm" />
        <View style={styles.label}>
          <AppText variant="bodyStrong">Balance del mes</AppText>
          <AppText variant="caption" color="textSecondary">
            Ingresos menos gastos
          </AppText>
        </View>
        <AppText
          variant="amountLarge"
          color={netMinor < 0 ? 'expense' : 'textPrimary'}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.amount}
        >
          {net}
        </AppText>
      </View>
    </Card>
  );
}

type SummaryRowProps = {
  testID: string;
  label: string;
  icon: IconName;
  tone: IconTone;
  color: ColorName;
  amountMinor: number;
  count: number;
  currency: CurrencyCode;
};

function SummaryRow({
  testID,
  label,
  icon,
  tone,
  color,
  amountMinor,
  count,
  currency,
}: SummaryRowProps) {
  const amount = formatMoney(amountMinor, currency);
  const movements = formatMovementCount(count);

  return (
    <View
      testID={testID}
      style={styles.row}
      accessible
      accessibilityLabel={`${label}: ${amount}, ${movements}`}
    >
      <IconBadge name={icon} variant={tone} size="sm" />
      <View style={styles.label}>
        <AppText>{label}</AppText>
        <AppText variant="caption" color="textSecondary">
          {movements}
        </AppText>
      </View>
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
