import { memo } from 'react';
import { AppText, ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import type { Transaction } from '../domain/types';
import type { ReferenceLookup } from './referenceLookup';
import { describeTransaction } from './transactionPresentation';

type TransactionListItemProps = {
  transaction: Transaction;
  references: ReferenceLookup;
  onPress: (id: string) => void;
  /** Off in lists already grouped by day, where the date is the section header. */
  showDate?: boolean;
};

/** A movement in a list: category/type icon, title, accounts and date, signed amount. */
export const TransactionListItem = memo(function TransactionListItemView({
  transaction,
  references,
  onPress,
  showDate = true,
}: TransactionListItemProps) {
  const view = describeTransaction(transaction, references);

  return (
    <ListItem
      testID={`transaction-${transaction.id}`}
      title={view.title}
      subtitle={showDate ? `${view.context} · ${view.date}` : view.context}
      leading={<IconBadge name={view.icon} variant={view.tone} />}
      trailing={
        <AppText variant="amount" color={view.amountColor}>
          {view.amount}
        </AppText>
      }
      onPress={() => onPress(transaction.id)}
      accessibilityLabel={view.accessibilityLabel}
      accessibilityHint="Abre el detalle del movimiento"
    />
  );
});
