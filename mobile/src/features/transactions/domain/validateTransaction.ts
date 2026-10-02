import type { Account, Card } from '../../accounts';
import type { Category } from '../../categories';
import type { Transaction } from './types';

export type TransactionValidationError =
  | 'amount_not_integer'
  | 'amount_not_positive'
  | 'to_account_not_allowed'
  | 'to_account_required'
  | 'to_account_same_as_account'
  | 'category_not_allowed_for_transfer'
  | 'card_not_allowed_for_transfer'
  | 'card_not_in_account'
  | 'local_date_invalid'
  | 'account_not_found'
  | 'to_account_not_found'
  | 'currency_mismatch'
  | 'category_not_found'
  | 'category_kind_mismatch';

export type TransactionValidationResult = {
  valid: boolean;
  errors: TransactionValidationError[];
};

/**
 * Other entities needed for the rules that cannot be checked from the Transaction alone.
 * The caller decides which ones are usable: when creating, the active ones; when editing,
 * also those the transaction already referenced (a past movement keeps an archived
 * category).
 */
export type TransactionValidationContext = {
  accounts: readonly Pick<Account, 'id' | 'currency'>[];
  cards: readonly Pick<Card, 'id' | 'accountId'>[];
  categories: readonly Pick<Category, 'id' | 'kind'>[];
};

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day in YYYY-MM-DD (rejects 2026-02-30). */
function isCalendarDate(value: string): boolean {
  const match = LOCAL_DATE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Rules that only need the Transaction itself. */
export function validateTransactionFields(
  transaction: Transaction,
): TransactionValidationError[] {
  const errors: TransactionValidationError[] = [];

  if (!Number.isInteger(transaction.amountMinor)) {
    errors.push('amount_not_integer');
  }
  if (!(transaction.amountMinor > 0)) {
    errors.push('amount_not_positive');
  }
  if (!isCalendarDate(transaction.localDate)) {
    errors.push('local_date_invalid');
  }

  if (transaction.type === 'transfer') {
    if (transaction.toAccountId === null) {
      errors.push('to_account_required');
    } else if (transaction.toAccountId === transaction.accountId) {
      errors.push('to_account_same_as_account');
    }
    if (transaction.categoryId !== null) {
      errors.push('category_not_allowed_for_transfer');
    }
    if (transaction.cardId !== null) {
      errors.push('card_not_allowed_for_transfer');
    }
  } else if (transaction.toAccountId !== null) {
    errors.push('to_account_not_allowed');
  }

  return errors;
}

/**
 * Rules that need related entities, supplied by the caller: the accounts exist and share
 * the transaction's currency (domain rules 6 and 10: no FX), the card belongs to the
 * account (rule 13) and the category classifies this type of movement.
 */
export function validateTransactionRelations(
  transaction: Transaction,
  context: TransactionValidationContext,
): TransactionValidationError[] {
  const errors: TransactionValidationError[] = [];

  const account = context.accounts.find(
    ({ id }) => id === transaction.accountId,
  );
  const toAccount =
    transaction.toAccountId === null
      ? undefined
      : context.accounts.find(({ id }) => id === transaction.toAccountId);
  if (!account) {
    errors.push('account_not_found');
  }
  if (transaction.toAccountId !== null && !toAccount) {
    errors.push('to_account_not_found');
  }
  if (
    (account && account.currency !== transaction.currency) ||
    (toAccount && toAccount.currency !== transaction.currency)
  ) {
    errors.push('currency_mismatch');
  }

  if (transaction.categoryId !== null && transaction.type !== 'transfer') {
    const category = context.categories.find(
      ({ id }) => id === transaction.categoryId,
    );
    if (!category) {
      errors.push('category_not_found');
    } else if (category.kind !== transaction.type) {
      errors.push('category_kind_mismatch');
    }
  }

  if (transaction.cardId !== null) {
    const card = context.cards.find(({ id }) => id === transaction.cardId);
    if (card?.accountId !== transaction.accountId) {
      errors.push('card_not_in_account');
    }
  }

  return errors;
}

/** Pure domain validation: no I/O, no state. Returns every broken rule, not just the first. */
export function validateTransaction(
  transaction: Transaction,
  context: TransactionValidationContext,
): TransactionValidationResult {
  const errors = [
    ...validateTransactionFields(transaction),
    ...validateTransactionRelations(transaction, context),
  ];
  return { valid: errors.length === 0, errors };
}
