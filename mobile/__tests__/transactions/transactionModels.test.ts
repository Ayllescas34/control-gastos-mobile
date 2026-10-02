import type { Account, Card } from '../../src/features/accounts';
import type { Category } from '../../src/features/categories';
import { createReferenceLookup } from '../../src/features/transactions/components/referenceLookup';
import {
  emptyTransactionForm,
  parseTransactionForm,
  resolveLocalDate,
  transactionToFormValues,
  type TransactionFormValues,
} from '../../src/features/transactions/components/transactionFormModel';
import {
  DEFAULT_FILTERS,
  extraFilterCount,
  toRepositoryFilters,
} from '../../src/features/transactions/components/transactionFilters';
import { describeTransaction } from '../../src/features/transactions/components/transactionPresentation';
import type { Transaction } from '../../src/features/transactions';
import {
  isValidLocalDate,
  monthRange,
  occurredAtFor,
  todayLocalDate,
} from '../../src/shared/lib/dates';

const STAMP = '2026-10-01T12:00:00.000Z';
// Local noon, so the civil date is the same in any time zone the tests run in.
const NOW = new Date(2026, 9, 15, 12, 0, 0);

const account = (fields: Partial<Account>): Account => ({
  id: 'bank',
  name: 'Banco',
  type: 'bank',
  currency: 'GTQ',
  initialBalanceMinor: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
  ...fields,
});

const references = createReferenceLookup({
  accounts: [
    account({}),
    account({ id: 'credit', name: 'Visa', type: 'credit_card' }),
    account({ id: 'old', name: 'Antigua', deletedAt: STAMP }),
  ],
  cards: [
    {
      id: 'debit',
      accountId: 'bank',
      alias: 'Débito',
      last4: '1111',
      network: null,
      createdAt: STAMP,
      updatedAt: STAMP,
      deletedAt: null,
    } satisfies Card,
  ],
  categories: [
    {
      id: 'food',
      name: 'Alimentación',
      kind: 'expense',
      icon: 'restaurant',
      createdAt: STAMP,
      updatedAt: STAMP,
      deletedAt: null,
    } satisfies Category,
  ],
});

const form = (
  fields: Partial<TransactionFormValues>,
): TransactionFormValues => ({
  ...emptyTransactionForm('expense', 'bank'),
  amount: '450.75',
  ...fields,
});

describe('parseTransactionForm', () => {
  it('builds an expense in exact minor units with the account currency', () => {
    const result = parseTransactionForm(
      form({
        categoryId: 'food',
        cardId: 'debit',
        payee: '  La Torre ',
        description: '',
      }),
      references,
      null,
      NOW,
    );

    expect(result).toEqual({
      ok: true,
      input: expect.objectContaining({
        type: 'expense',
        amountMinor: 45075,
        currency: 'GTQ',
        accountId: 'bank',
        categoryId: 'food',
        cardId: 'debit',
        toAccountId: null,
        payee: 'La Torre',
        description: null,
        localDate: '2026-10-15',
        occurredAt: NOW.toISOString(),
        source: 'manual',
        status: 'confirmed',
      }),
    });
  });

  it('clears what a transfer cannot have (category, card, payee)', () => {
    const result = parseTransactionForm(
      form({
        type: 'transfer',
        toAccountId: 'credit',
        categoryId: 'food',
        cardId: 'debit',
        payee: 'X',
      }),
      references,
      null,
      NOW,
    );
    expect(result.ok && result.input).toMatchObject({
      type: 'transfer',
      toAccountId: 'credit',
      categoryId: null,
      cardId: null,
      payee: null,
    });
  });

  it('clears the card of an income', () => {
    const result = parseTransactionForm(
      form({ type: 'income', cardId: 'debit' }),
      references,
      null,
      NOW,
    );
    expect(result.ok && result.input.cardId).toBeNull();
  });

  it('reports every missing field before touching the repository', () => {
    expect(
      parseTransactionForm(
        { ...emptyTransactionForm(null, null) },
        references,
        null,
        NOW,
      ),
    ).toEqual({
      ok: false,
      errors: {
        type: 'Elige el tipo de movimiento.',
        amount: 'Escribe el monto.',
        accountId: 'Elige una cuenta.',
      },
    });
  });

  it.each([
    ['0', 'El monto debe ser mayor que cero.'],
    ['-10', 'El monto debe ser mayor que cero.'],
    ['abc', 'Escribe un monto como 450 o 1,250.75.'],
    ['1.234', 'Usa como máximo 2 decimales.'],
  ])('rejects the amount "%s"', (amount, message) => {
    const result = parseTransactionForm(
      form({ amount }),
      references,
      null,
      NOW,
    );
    expect(result).toEqual({ ok: false, errors: { amount: message } });
  });

  it('applies the domain transfer rules', () => {
    expect(
      parseTransactionForm(form({ type: 'transfer' }), references, null, NOW),
    ).toEqual({
      ok: false,
      errors: { toAccountId: 'Elige la cuenta destino.' },
    });
  });

  it('validates a date typed by hand', () => {
    const result = parseTransactionForm(
      form({ dateChoice: 'other', otherDate: '2026-02-30' }),
      references,
      null,
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      errors: { date: 'Escribe una fecha válida (AAAA-MM-DD).' },
    });
  });

  it('keeps the instant and origin of an edited movement when its date is unchanged', () => {
    const previous: Transaction = {
      id: 't1',
      type: 'expense',
      amountMinor: 100,
      currency: 'GTQ',
      accountId: 'bank',
      toAccountId: null,
      categoryId: null,
      cardId: null,
      occurredAt: '2026-10-10T20:15:00.000Z',
      localDate: '2026-10-10',
      description: null,
      payee: null,
      note: null,
      source: 'import',
      status: 'pending',
      externalRef: 'bank-1',
      createdAt: STAMP,
      updatedAt: STAMP,
      deletedAt: null,
    };
    const values = {
      ...transactionToFormValues(previous, NOW),
      amount: '2.00',
    };
    const result = parseTransactionForm(values, references, previous, NOW);

    expect(result.ok && result.input).toMatchObject({
      amountMinor: 200,
      occurredAt: '2026-10-10T20:15:00.000Z',
      localDate: '2026-10-10',
      source: 'import',
      status: 'pending',
      externalRef: 'bank-1',
    });
  });
});

describe('resolveLocalDate', () => {
  it('maps today, yesterday and a typed date', () => {
    const base = emptyTransactionForm('expense', 'bank');
    expect(resolveLocalDate(base, NOW)).toBe('2026-10-15');
    expect(resolveLocalDate({ ...base, dateChoice: 'yesterday' }, NOW)).toBe(
      '2026-10-14',
    );
    expect(
      resolveLocalDate(
        { ...base, dateChoice: 'other', otherDate: '2026-01-31' },
        NOW,
      ),
    ).toBe('2026-01-31');
    expect(
      resolveLocalDate(
        { ...base, dateChoice: 'other', otherDate: '31/01/2026' },
        NOW,
      ),
    ).toBeNull();
  });
});

describe('toRepositoryFilters', () => {
  it('returns no filters by default', () => {
    expect(toRepositoryFilters(DEFAULT_FILTERS, '  ', NOW)).toEqual({});
  });

  it('combines type, account, category, period and search', () => {
    expect(
      toRepositoryFilters(
        {
          type: 'expense',
          period: 'thisMonth',
          accountId: 'bank',
          categoryId: 'food',
        },
        ' torre ',
        NOW,
      ),
    ).toEqual({
      type: 'expense',
      accountId: 'bank',
      categoryId: 'food',
      from: '2026-10-01',
      to: '2026-10-31',
      search: 'torre',
    });
  });

  it('computes last month and the last 30 days (inclusive)', () => {
    expect(
      toRepositoryFilters({ ...DEFAULT_FILTERS, period: 'lastMonth' }, '', NOW),
    ).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(
      toRepositoryFilters(
        { ...DEFAULT_FILTERS, period: 'last30Days' },
        '',
        NOW,
      ),
    ).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });

  it('ignores a category when only transfers are shown', () => {
    const state = {
      ...DEFAULT_FILTERS,
      type: 'transfer' as const,
      categoryId: 'food',
    };
    expect(toRepositoryFilters(state, '', NOW)).toEqual({ type: 'transfer' });
    expect(extraFilterCount(state)).toBe(0);
  });
});

describe('describeTransaction', () => {
  const base: Transaction = {
    id: 't',
    type: 'expense',
    amountMinor: 45075,
    currency: 'GTQ',
    accountId: 'bank',
    toAccountId: null,
    categoryId: 'food',
    cardId: null,
    occurredAt: STAMP,
    localDate: '2026-10-01',
    description: null,
    payee: 'La Torre',
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    deletedAt: null,
  };

  it('shows an expense with its category icon, payee and signed amount', () => {
    const view = describeTransaction(base, references);
    expect(view).toMatchObject({
      title: 'La Torre',
      icon: 'restaurant',
      tone: 'expense',
    });
    expect(view.context).toContain('Alimentación · Banco');
    expect(view.amount.startsWith('−')).toBe(true);
  });

  it('shows a transfer as origin → destination, archived accounts included', () => {
    const view = describeTransaction(
      {
        ...base,
        type: 'transfer',
        categoryId: null,
        payee: null,
        accountId: 'old',
        toAccountId: 'credit',
      },
      references,
    );
    expect(view).toMatchObject({
      title: 'Transferencia',
      icon: 'arrowLeftRight',
    });
    expect(view.context).toContain('Antigua → Visa');
  });
});

describe('local dates', () => {
  it('validates real calendar days', () => {
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-1-01')).toBe(false);
  });

  it('stores now for today and local noon for another day', () => {
    expect(occurredAtFor(todayLocalDate(NOW), NOW)).toBe(NOW.toISOString());
    expect(occurredAtFor('2026-10-01', NOW)).toBe(
      new Date(2026, 9, 1, 12, 0, 0).toISOString(),
    );
  });

  it('gives month ranges', () => {
    expect(monthRange(new Date(2026, 1, 10))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
});
