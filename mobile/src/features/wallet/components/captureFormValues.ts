import type { EntityId } from '../../../shared/domain';
import {
  localDateDaysBefore,
  toLocalDate,
  todayLocalDate,
} from '../../../shared/lib/dates';
import { formatMoneyInput } from '../../../shared/lib/money';
// By module, not the transactions feature index, to keep features free of import cycles.
import {
  emptyTransactionForm,
  type TransactionFormValues,
} from '../../transactions/components/transactionFormModel';
import type { WalletCapture } from '../domain/types';

const TYPE_OF_KIND = {
  expense: 'expense',
  income: 'income',
  withdrawal: 'transfer',
} as const;

/**
 * The movement form prefilled from a capture, with its amount, place and day, on the
 * matched account (or the only account): an expense with the merchant's usual category, an
 * income, or for an ATM withdrawal a transfer to the cash account.
 */
export function captureToFormValues(
  capture: WalletCapture,
  options: {
    match: { cardId: EntityId | null; accountId: EntityId } | null;
    defaultAccountId: EntityId | null;
    suggestedCategoryId: EntityId | null;
    cashAccountId?: EntityId | null;
  },
  now: Date = new Date(),
): TransactionFormValues {
  const localDate = toLocalDate(new Date(capture.postedAt));
  const today = todayLocalDate(now);
  const dateChoice =
    localDate === today
      ? 'today'
      : localDate === localDateDaysBefore(today, 1)
      ? 'yesterday'
      : 'other';
  const type = TYPE_OF_KIND[capture.kind];
  const isTransfer = type === 'transfer';
  return {
    ...emptyTransactionForm(
      type,
      options.match?.accountId ?? options.defaultAccountId,
    ),
    amount: formatMoneyInput(capture.amountMinor, capture.currency),
    toAccountId: isTransfer ? options.cashAccountId ?? null : null,
    cardId: type === 'expense' ? options.match?.cardId ?? null : null,
    categoryId: isTransfer ? null : options.suggestedCategoryId,
    dateChoice,
    otherDate: dateChoice === 'other' ? localDate : '',
    payee: isTransfer ? '' : capture.merchant ?? '',
    description:
      isTransfer && capture.merchant ? `Retiro en ${capture.merchant}` : '',
  };
}
