import type { Card } from '../../accounts';
import type { Transaction } from './types';

export type TransactionValidationError =
  | 'amount_not_integer'
  | 'amount_not_positive'
  | 'to_account_not_allowed'
  | 'to_account_required'
  | 'to_account_same_as_account'
  | 'category_not_allowed_for_transfer'
  | 'card_not_allowed_for_transfer'
  | 'card_not_in_account';

export type TransactionValidationResult = {
  valid: boolean;
  errors: TransactionValidationError[];
};

/** Other entities needed for the rules that cannot be checked from the Transaction alone. */
export type TransactionValidationContext = {
  cards: readonly Pick<Card, 'id' | 'accountId'>[];
};

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
 * Rules that need related entities, supplied by the caller.
 * Account-level rules (e.g. currency must match the account) are not checked yet.
 */
export function validateTransactionRelations(
  transaction: Transaction,
  context: TransactionValidationContext,
): TransactionValidationError[] {
  const errors: TransactionValidationError[] = [];

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
