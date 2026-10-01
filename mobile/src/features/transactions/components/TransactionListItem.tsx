import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import { layout, spacing, useAppTheme } from '../../../shared/theme';
import type { Transaction } from '../domain/types';
import { TRANSACTION_TYPE_VISUALS } from './transactionTypeVisuals';

type TransactionListItemProps = {
  transaction: Transaction;
  onPress: (id: string) => void;
};

export function TransactionListItem({
  transaction,
  onPress,
}: TransactionListItemProps) {
  const theme = useAppTheme();
  const visual = TRANSACTION_TYPE_VISUALS[transaction.type];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(transaction.id)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {/* The row is one accessible button, so the badge label joins its announcement. */}
      <IconBadge
        name={visual.icon}
        variant={visual.tone}
        accessibilityLabel={visual.label}
      />
      <View style={styles.info}>
        <AppText variant="bodyStrong">{transaction.description}</AppText>
        <AppText variant="caption" color="textSecondary">
          {formatLocalDate(transaction.localDate)}
        </AppText>
      </View>
      <AppText variant="amount" color={visual.amountColor}>
        {visual.sign}
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
    gap: layout.listItemGap,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: {
    flex: 1,
    gap: 2,
  },
});
