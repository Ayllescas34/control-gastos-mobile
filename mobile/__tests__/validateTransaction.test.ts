import type { Transaction } from '../src/features/transactions/domain/types';
import {
  validateTransaction,
  type TransactionValidationContext,
} from '../src/features/transactions/domain/validateTransaction';

const BANK = 'account-bank';
const CREDIT = 'account-credit';

const context: TransactionValidationContext = {
  cards: [
    { id: 'card-debit', accountId: BANK },
    { id: 'card-credit', accountId: CREDIT },
  ],
};

const buildTransaction = (fields: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  type: 'expense',
  amountMinor: 10000,
  currency: 'GTQ',
  accountId: BANK,
  toAccountId: null,
  categoryId: null,
  cardId: null,
  occurredAt: '2026-09-28T19:30:00.000Z',
  localDate: '2026-09-28',
  description: null,
  payee: null,
  note: null,
  source: 'manual',
  status: 'confirmed',
  externalRef: null,
  createdAt: '2026-09-28T19:30:00.000Z',
  updatedAt: '2026-09-28T19:30:00.000Z',
  deletedAt: null,
  ...fields,
});

describe('validateTransaction', () => {
  it('accepts a valid income', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'income', categoryId: 'category-salary' }),
      context,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a valid expense paid with a card of the same account', () => {
    const result = validateTransaction(
      buildTransaction({
        type: 'expense',
        accountId: CREDIT,
        cardId: 'card-credit',
        categoryId: 'category-fuel',
      }),
      context,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts a valid transfer (credit card payment)', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'transfer', accountId: BANK, toAccountId: CREDIT }),
      context,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a transfer without toAccountId', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'transfer', toAccountId: null }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('to_account_required');
  });

  it('rejects a transfer to the same account', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'transfer', accountId: BANK, toAccountId: BANK }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('to_account_same_as_account');
  });

  it('rejects an income with toAccountId', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'income', toAccountId: CREDIT }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('to_account_not_allowed');
  });

  it('rejects an expense with toAccountId', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'expense', toAccountId: CREDIT }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('to_account_not_allowed');
  });

  it('rejects a transfer with cardId', () => {
    const result = validateTransaction(
      buildTransaction({
        type: 'transfer',
        accountId: BANK,
        toAccountId: CREDIT,
        cardId: 'card-debit',
      }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('card_not_allowed_for_transfer');
  });

  it('rejects a transfer with categoryId', () => {
    const result = validateTransaction(
      buildTransaction({
        type: 'transfer',
        accountId: BANK,
        toAccountId: CREDIT,
        categoryId: 'category-any',
      }),
      context,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('category_not_allowed_for_transfer');
  });

  it('rejects an expense with a card that belongs to another account', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'expense', accountId: BANK, cardId: 'card-credit' }),
      context,
    );
    expect(result).toEqual({ valid: false, errors: ['card_not_in_account'] });
  });

  it('rejects an expense with an unknown card', () => {
    const result = validateTransaction(
      buildTransaction({ type: 'expense', cardId: 'card-missing' }),
      context,
    );
    expect(result).toEqual({ valid: false, errors: ['card_not_in_account'] });
  });

  it('rejects amountMinor equal to 0', () => {
    const result = validateTransaction(buildTransaction({ amountMinor: 0 }), context);
    expect(result).toEqual({ valid: false, errors: ['amount_not_positive'] });
  });

  it('rejects a negative amountMinor', () => {
    const result = validateTransaction(
      buildTransaction({ amountMinor: -500 }),
      context,
    );
    expect(result).toEqual({ valid: false, errors: ['amount_not_positive'] });
  });

  it('rejects a non-integer amountMinor', () => {
    const result = validateTransaction(
      buildTransaction({ amountMinor: 100.5 }),
      context,
    );
    expect(result).toEqual({ valid: false, errors: ['amount_not_integer'] });
  });
});
