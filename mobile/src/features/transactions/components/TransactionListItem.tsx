import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import { spacing, useAppTheme, type ColorName } from '../../../shared/theme';
import type { Transaction, TransactionType } from '../domain/types';

const AMOUNT_STYLE: Record<TransactionType, { sign: string; color: ColorName }> =
  {
    income: { sign: '+', color: 'income' },
    expense: { sign: '−', color: 'expense' },
    transfer: { sign: '', color: 'textSecondary' },
  };

type TransactionListItemProps = {
  transaction: Transaction;
  onPress: (id: string) => void;
};

export function TransactionListItem({
  transaction,
  onPress,
}: TransactionListItemProps) {
  const theme = useAppTheme();
  const amountStyle = AMOUNT_STYLE[transaction.type];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(transaction.id)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={styles.info}>
        <AppText variant="bodyStrong">{transaction.description}</AppText>
        <AppText variant="caption" color="textSecondary">
          {formatLocalDate(transaction.localDate)}
        </AppText>
      </View>
      <AppText variant="bodyStrong" color={amountStyle.color}>
        {amountStyle.sign}
        {formatMoney(transaction.amountMinor, transaction.currency)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: {
    flex: 1,
    gap: 2,
  },
});
