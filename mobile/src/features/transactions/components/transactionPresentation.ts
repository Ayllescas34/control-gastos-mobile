import type { IconName, IconTone } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import type { ColorName } from '../../../shared/theme';
import type { Transaction } from '../domain/types';
import type { ReferenceLookup } from './referenceLookup';
import { TRANSACTION_TYPE_VISUALS } from './transactionTypeVisuals';

export type TransactionPresentation = {
  title: string;
  /** Accounts involved and category or type. */
  context: string;
  /** Formatted civil date. */
  date: string;
  icon: IconName;
  tone: IconTone;
  /** Signed, formatted amount, e.g. "−Q 450.75". */
  amount: string;
  amountColor: ColorName;
  accessibilityLabel: string;
};

const ARCHIVED_ACCOUNT = 'Cuenta archivada';

/**
 * How a movement reads in lists: its category icon (or its type's), a title from what the
 * user typed (payee, then description, then category or type), and the accounts involved.
 * Presentation only: nothing here changes or validates data.
 */
export function describeTransaction(
  transaction: Transaction,
  references: ReferenceLookup,
): TransactionPresentation {
  const visual = TRANSACTION_TYPE_VISUALS[transaction.type];
  const category = references.category(transaction.categoryId);
  const accountName =
    references.account(transaction.accountId)?.name ?? ARCHIVED_ACCOUNT;
  const date = formatLocalDate(transaction.localDate);

  const title =
    transaction.payee ??
    transaction.description ??
    category?.name ??
    visual.label;

  let context: string;
  if (transaction.type === 'transfer') {
    const toName =
      references.account(transaction.toAccountId)?.name ?? ARCHIVED_ACCOUNT;
    context = `${accountName} → ${toName}`;
  } else {
    context = `${category?.name ?? visual.label} · ${accountName}`;
  }

  const amount = `${visual.sign}${formatMoney(
    transaction.amountMinor,
    transaction.currency,
  )}`;

  return {
    title,
    context,
    date,
    icon:
      category && transaction.type !== 'transfer' ? category.icon : visual.icon,
    tone: visual.tone,
    amount,
    amountColor: visual.amountColor,
    accessibilityLabel: `${visual.label}, ${title}, ${amount}, ${context}, ${date}`,
  };
}
