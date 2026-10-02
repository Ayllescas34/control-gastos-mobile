import { sql } from 'drizzle-orm';
import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import {
  createTransactionRepository,
  InvalidTransactionError,
  type NewTransaction,
  type TransactionRepository,
} from '../../src/features/transactions';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';

const NOW = '2026-09-30T12:00:00.000Z';
const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 9007199254740991

let database: Database;
let transactions: TransactionRepository;
let bank: Account;
let cash: Account;
let creditCard: Account;
let visa: Card;
let debit: Card;

beforeEach(async () => {
  database = await createTestDatabase();
  const accounts = createAccountRepository(database.db);
  const cards = createCardRepository(database.db);
  transactions = createTransactionRepository(database.db);

  bank = await accounts.create({
    name: 'Banco',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 100000,
  });
  cash = await accounts.create({
    name: 'Efectivo',
    type: 'cash',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  creditCard = await accounts.create({
    name: 'Tarjeta de crédito',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  visa = await cards.create({
    accountId: creditCard.id,
    alias: 'Visa oro',
    last4: '4242',
    network: 'visa',
  });
  debit = await cards.create({
    accountId: bank.id,
    alias: 'Débito',
    last4: '1111',
    network: 'mastercard',
  });
});

afterEach(() => database.close());

function movement(overrides: Partial<NewTransaction>): NewTransaction {
  return {
    type: 'expense',
    amountMinor: 1000,
    currency: 'GTQ',
    accountId: bank.id,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    occurredAt: NOW,
    localDate: '2026-09-30',
    description: null,
    payee: null,
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
    ...overrides,
  };
}

async function expectInvalid(
  promise: Promise<unknown>,
  error: InvalidTransactionError['errors'][number],
) {
  await expect(promise).rejects.toBeInstanceOf(InvalidTransactionError);
  await expect(promise).rejects.toMatchObject({
    errors: expect.arrayContaining([error]),
  });
}

/** Inserts bypassing the repository, to prove the DB itself is a second barrier. */
function rawInsert(values: {
  type: string;
  amount: number | string;
  account: string;
  toAccount?: string | null;
  category?: string | null;
  card?: string | null;
}) {
  return database.db.run(sql`INSERT INTO transactions (
      id, type, amount_minor, currency, account_id, to_account_id, category_id, card_id,
      occurred_at, local_date, source, status, created_at, updated_at
    ) VALUES (
      ${`raw-${Math.random()}`}, ${values.type}, ${values.amount}, 'GTQ', ${
    values.account
  }, ${values.toAccount ?? null}, ${values.category ?? null}, ${
    values.card ?? null
  }, ${NOW}, '2026-09-30', 'manual', 'confirmed', ${NOW}, ${NOW}
    )`);
}

describe('create and read', () => {
  it('creates an expense', async () => {
    const expense = await transactions.create(
      movement({ type: 'expense', amountMinor: 2550, payee: 'Super' }),
    );
    expect(await transactions.getById(expense.id)).toEqual(expense);
  });

  it('creates an income', async () => {
    const income = await transactions.create(
      movement({ type: 'income', amountMinor: 500000, description: 'Salario' }),
    );
    expect(await transactions.getById(income.id)).toEqual(income);
  });

  it('creates a transfer as a single row', async () => {
    const transfer = await transactions.create(
      movement({ type: 'transfer', amountMinor: 20000, toAccountId: cash.id }),
    );
    expect(await transactions.getById(transfer.id)).toEqual(transfer);
    expect(await transactions.list()).toHaveLength(1);
    expect(
      (await transactions.listByAccount(cash.id)).map(t => t.id),
    ).toEqual([transfer.id]);
  });

  it('keeps amountMinor exact up to Number.MAX_SAFE_INTEGER', async () => {
    const big = await transactions.create(
      movement({ type: 'income', amountMinor: MAX_SAFE }),
    );
    expect((await transactions.getById(big.id))?.amountMinor).toBe(MAX_SAFE);

    const [[storedType]] = await database.db.values<[string]>(
      sql`SELECT typeof(amount_minor) FROM transactions WHERE id = ${big.id}`,
    );
    expect(storedType).toBe('integer');
  });

  it('lists most recent first and filters by account', async () => {
    const older = await transactions.create(
      movement({ localDate: '2026-09-01', occurredAt: '2026-09-01T10:00:00.000Z' }),
    );
    const newer = await transactions.create(
      movement({ localDate: '2026-09-20', occurredAt: '2026-09-20T10:00:00.000Z' }),
    );
    const other = await transactions.create(
      movement({ accountId: cash.id }),
    );

    expect((await transactions.list()).map(t => t.id)).toEqual([
      other.id,
      newer.id,
      older.id,
    ]);
    expect((await transactions.listByAccount(bank.id)).map(t => t.id)).toEqual(
      [newer.id, older.id],
    );
  });
});

describe('domain validation runs before writing', () => {
  it('transfer requires toAccountId', async () => {
    await expectInvalid(
      transactions.create(movement({ type: 'transfer' })),
      'to_account_required',
    );
  });

  it('transfer does not allow a card', async () => {
    await expectInvalid(
      transactions.create(
        movement({ type: 'transfer', toAccountId: cash.id, cardId: debit.id }),
      ),
      'card_not_allowed_for_transfer',
    );
  });

  it('transfer does not allow a category', async () => {
    await expectInvalid(
      transactions.create(
        movement({ type: 'transfer', toAccountId: cash.id, categoryId: 'cat' }),
      ),
      'category_not_allowed_for_transfer',
    );
  });

  it('accountId and toAccountId must differ', async () => {
    await expectInvalid(
      transactions.create(movement({ type: 'transfer', toAccountId: bank.id })),
      'to_account_same_as_account',
    );
  });

  it('income/expense do not allow toAccountId', async () => {
    await expectInvalid(
      transactions.create(movement({ type: 'expense', toAccountId: cash.id })),
      'to_account_not_allowed',
    );
  });

  it('the card must belong to the account', async () => {
    await expectInvalid(
      transactions.create(movement({ accountId: bank.id, cardId: visa.id })),
      'card_not_in_account',
    );
  });

  it('amountMinor must be an integer', async () => {
    await expectInvalid(
      transactions.create(movement({ amountMinor: 10.5 })),
      'amount_not_integer',
    );
  });

  it('amountMinor must be positive', async () => {
    await expectInvalid(
      transactions.create(movement({ amountMinor: 0 })),
      'amount_not_positive',
    );
    await expectInvalid(
      transactions.create(movement({ amountMinor: -100 })),
      'amount_not_positive',
    );
  });

  it('nothing is written when validation fails', async () => {
    await transactions
      .create(movement({ type: 'transfer' }))
      .catch(() => undefined);
    expect(await transactions.list()).toEqual([]);
  });
});

describe('the database is a second barrier', () => {
  it('rejects a transfer without destination', async () => {
    expect(
      await sqliteErrorMessage(
        rawInsert({ type: 'transfer', amount: 100, account: bank.id }),
      ),
    ).toMatch(/transactions_transfer_check/);
  });

  it('rejects a transfer to the same account', async () => {
    expect(await sqliteErrorMessage(rawInsert({
        type: 'transfer',
        amount: 100,
        account: bank.id,
        toAccount: bank.id,
      }))).toMatch(/transactions_transfer_check/);
  });

  it('rejects a transfer with card or category', async () => {
    expect(await sqliteErrorMessage(rawInsert({
        type: 'transfer',
        amount: 100,
        account: bank.id,
        toAccount: cash.id,
        card: debit.id,
      }))).toMatch(/transactions_transfer_check/);
    expect(await sqliteErrorMessage(rawInsert({
        type: 'transfer',
        amount: 100,
        account: bank.id,
        toAccount: cash.id,
        category: 'cat',
      }))).toMatch(/transactions_transfer_check/);
  });

  it('rejects toAccountId on income/expense', async () => {
    expect(await sqliteErrorMessage(rawInsert({
        type: 'income',
        amount: 100,
        account: bank.id,
        toAccount: cash.id,
      }))).toMatch(/transactions_transfer_check/);
  });

  it('rejects a card that belongs to another account (composite FK)', async () => {
    expect(await sqliteErrorMessage(rawInsert({
        type: 'expense',
        amount: 100,
        account: bank.id,
        card: visa.id,
      }))).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('rejects unknown accounts (FK)', async () => {
    expect(await sqliteErrorMessage(rawInsert({ type: 'expense', amount: 100, account: 'missing' }))).toMatch(/FOREIGN KEY constraint failed/);
    expect(await sqliteErrorMessage(rawInsert({
        type: 'transfer',
        amount: 100,
        account: bank.id,
        toAccount: 'missing',
      }))).toMatch(/FOREIGN KEY constraint failed/);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['decimal', 10.5],
    ['non-numeric text', 'abc'],
    ['beyond 2^53 - 1', MAX_SAFE + 1],
  ])('rejects a %s amount', async (_label, amount) => {
    expect(await sqliteErrorMessage(rawInsert({ type: 'expense', amount, account: bank.id }))).toMatch(/transactions_amount_minor_check/);
  });

  it('rejects unknown type, source and status', async () => {
    expect(await sqliteErrorMessage(rawInsert({ type: 'refund', amount: 100, account: bank.id }))).toMatch(/CHECK constraint failed/);
    expect(await sqliteErrorMessage(database.db.run(sql`INSERT INTO transactions (
        id, type, amount_minor, currency, account_id, occurred_at, local_date, source, status, created_at, updated_at
      ) VALUES ('t', 'income', 1, 'GTQ', ${bank.id}, ${NOW}, '2026-09-30', 'bank', 'confirmed', ${NOW}, ${NOW})`))).toMatch(/transactions_source_check/);
    expect(await sqliteErrorMessage(database.db.run(sql`INSERT INTO transactions (
        id, type, amount_minor, currency, account_id, occurred_at, local_date, source, status, created_at, updated_at
      ) VALUES ('t', 'income', 1, 'GTQ', ${bank.id}, ${NOW}, '2026-09-30', 'manual', 'void', ${NOW}, ${NOW})`))).toMatch(/transactions_status_check/);
  });

  it('rejects a localDate that is not YYYY-MM-DD', async () => {
    expect(await sqliteErrorMessage(database.db.run(sql`INSERT INTO transactions (
        id, type, amount_minor, currency, account_id, occurred_at, local_date, source, status, created_at, updated_at
      ) VALUES ('t', 'income', 1, 'GTQ', ${bank.id}, ${NOW}, '30/09/2026', 'manual', 'confirmed', ${NOW}, ${NOW})`))).toMatch(/transactions_dates_check/);
  });
});

describe('update and soft delete', () => {
  it('updates with validation of the resulting entity', async () => {
    const expense = await transactions.create(movement({ amountMinor: 1000 }));

    const updated = await transactions.update(expense.id, {
      amountMinor: 1250,
      note: 'corregido',
    });
    expect(updated).toMatchObject({ amountMinor: 1250, note: 'corregido' });
    expect(await transactions.getById(expense.id)).toEqual(updated);

    await expectInvalid(
      transactions.update(expense.id, { type: 'transfer' }),
      'to_account_required',
    );
    expect((await transactions.getById(expense.id))?.type).toBe('expense');
  });

  it('soft deleted transactions disappear from reads and balances', async () => {
    const expense = await transactions.create(movement({ amountMinor: 3000 }));
    expect(await transactions.getAccountBalance(bank.id)).toBe(97000);

    expect(await transactions.softDelete(expense.id)).toBe(true);
    expect(await transactions.getById(expense.id)).toBeNull();
    expect(await transactions.list()).toEqual([]);
    expect(await transactions.listByAccount(bank.id)).toEqual([]);
    expect(await transactions.update(expense.id, { note: 'x' })).toBeNull();
    expect(await transactions.getAccountBalance(bank.id)).toBe(100000);
  });
});

describe('derived balances', () => {
  it('initial + income - expense', async () => {
    await transactions.create(movement({ type: 'income', amountMinor: 50000 }));
    await transactions.create(movement({ type: 'expense', amountMinor: 12345 }));
    expect(await transactions.getAccountBalance(bank.id)).toBe(
      100000 + 50000 - 12345,
    );
  });

  it('a transfer leaves the origin and enters the destination', async () => {
    await transactions.create(
      movement({ type: 'transfer', amountMinor: 30000, toAccountId: cash.id }),
    );
    expect(await transactions.getAccountBalance(bank.id)).toBe(70000);
    expect(await transactions.getAccountBalance(cash.id)).toBe(30000);
  });

  it('credit card: purchases make it more negative, a payment brings it toward 0', async () => {
    const purchase = await transactions.create(
      movement({
        type: 'expense',
        amountMinor: 45000,
        accountId: creditCard.id,
        cardId: visa.id,
        payee: 'Tienda',
      }),
    );
    expect(purchase.cardId).toBe(visa.id);
    expect(await transactions.getAccountBalance(creditCard.id)).toBe(-45000);

    // Payment: transfer bank → credit_card, no card, not another expense.
    await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 45000,
        accountId: bank.id,
        toAccountId: creditCard.id,
      }),
    );
    expect(await transactions.getAccountBalance(creditCard.id)).toBe(0);
    expect(await transactions.getAccountBalance(bank.id)).toBe(55000);

    const expenses = (await transactions.list()).filter(
      t => t.type === 'expense',
    );
    expect(expenses.map(t => t.id)).toEqual([purchase.id]);
  });

  it('a debit card purchase reduces the bank account', async () => {
    await transactions.create(
      movement({ type: 'expense', amountMinor: 800, cardId: debit.id }),
    );
    expect(await transactions.getAccountBalance(bank.id)).toBe(99200);
  });

  it('includes pending transactions (their effect is still undecided in the domain)', async () => {
    await transactions.create(
      movement({ type: 'expense', amountMinor: 500, status: 'pending' }),
    );
    expect(await transactions.getAccountBalance(bank.id)).toBe(99500);
  });

  it('is null for a missing or deleted account', async () => {
    expect(await transactions.getAccountBalance('missing')).toBeNull();

    await createAccountRepository(database.db).softDelete(cash.id);
    expect(await transactions.getAccountBalance(cash.id)).toBeNull();
  });
});

describe('atomic writes', () => {
  it('rolls back repository writes made inside a failed transaction', async () => {
    await expect(
      database.withTransaction(async tx => {
        const repo = createTransactionRepository(tx);
        await repo.create(movement({ type: 'income', amountMinor: 1 }));
        await repo.create(movement({ type: 'transfer' })); // invalid: no destination
      }),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
    expect(await transactions.list()).toEqual([]);
  });
});

const ids = (list: { id: string }[]) => list.map(item => item.id);

async function categoryNamed(name: string): Promise<Category> {
  const found = (
    await createCategoryRepository(database.db).list({ includeArchived: true })
  ).find(category => category.name === name);
  if (!found) {
    throw new Error(`No category ${name}`);
  }
  return found;
}

describe('relations validated against stored data', () => {
  it('accepts an expense with an expense category and an income with an income one', async () => {
    const groceries = await categoryNamed('Supermercado');
    const salary = await categoryNamed('Salario');

    await transactions.create(movement({ categoryId: groceries.id }));
    await transactions.create(
      movement({ type: 'income', categoryId: salary.id }),
    );
    expect(await transactions.list()).toHaveLength(2);
  });

  it('rejects a category of the other kind', async () => {
    const salary = await categoryNamed('Salario');
    await expectInvalid(
      transactions.create(movement({ type: 'expense', categoryId: salary.id })),
      'category_kind_mismatch',
    );
  });

  it('rejects an unknown or archived category for a new movement', async () => {
    await expectInvalid(
      transactions.create(movement({ categoryId: 'missing' })),
      'category_not_found',
    );
    const travel = await categoryNamed('Viajes');
    await createCategoryRepository(database.db).softDelete(travel.id);
    await expectInvalid(
      transactions.create(movement({ categoryId: travel.id })),
      'category_not_found',
    );
  });

  it('keeps an archived category when editing an old movement', async () => {
    const travel = await categoryNamed('Viajes');
    const trip = await transactions.create(
      movement({ categoryId: travel.id, amountMinor: 50000 }),
    );
    await createCategoryRepository(database.db).softDelete(travel.id);

    const updated = await transactions.update(trip.id, { note: 'Hotel' });
    expect(updated).toMatchObject({ categoryId: travel.id, note: 'Hotel' });
  });

  it('rejects unknown and archived accounts', async () => {
    await expectInvalid(
      transactions.create(movement({ accountId: 'missing' })),
      'account_not_found',
    );
    await createAccountRepository(database.db).softDelete(cash.id);
    await expectInvalid(
      transactions.create(movement({ accountId: cash.id })),
      'account_not_found',
    );
    await expectInvalid(
      transactions.create(movement({ type: 'transfer', toAccountId: cash.id })),
      'to_account_not_found',
    );
  });

  it('requires the currency of the account (and of both transfer accounts)', async () => {
    await expectInvalid(
      transactions.create(movement({ currency: 'USD' })),
      'currency_mismatch',
    );
    const dollars = await createAccountRepository(database.db).create({
      name: 'Dólares',
      type: 'bank',
      currency: 'USD',
      initialBalanceMinor: 0,
    });
    await expectInvalid(
      transactions.create(
        movement({ type: 'transfer', toAccountId: dollars.id }),
      ),
      'currency_mismatch',
    );
  });

  it('rejects an archived card for a new movement', async () => {
    await createCardRepository(database.db).softDelete(debit.id);
    await expectInvalid(
      transactions.create(movement({ cardId: debit.id })),
      'card_not_in_account',
    );
  });

  it('rejects a date that does not exist', async () => {
    await expectInvalid(
      transactions.create(movement({ localDate: '2026-02-30' })),
      'local_date_invalid',
    );
  });
});

describe('filters and search', () => {
  async function seed() {
    const groceries = await categoryNamed('Supermercado');
    const market = await transactions.create(
      movement({
        amountMinor: 45075,
        payee: 'Supermercado La Torre',
        categoryId: groceries.id,
        localDate: '2026-09-05',
        occurredAt: '2026-09-05T16:00:00.000Z',
      }),
    );
    const salary = await transactions.create(
      movement({
        type: 'income',
        amountMinor: 1250000,
        description: 'Salario septiembre',
        localDate: '2026-09-25',
        occurredAt: '2026-09-25T16:00:00.000Z',
      }),
    );
    const savings = await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 20000,
        toAccountId: cash.id,
        note: 'Para la semana: 100% efectivo',
        localDate: '2026-10-01',
        occurredAt: '2026-10-01T16:00:00.000Z',
      }),
    );
    const archived = await transactions.create(
      movement({ payee: 'Supermercado viejo', localDate: '2026-09-06' }),
    );
    await transactions.softDelete(archived.id);
    return { market, salary, savings, groceriesId: groceries.id };
  }

  it('filters by type', async () => {
    const { market, salary, savings } = await seed();
    expect(ids(await transactions.list({ type: 'expense' }))).toEqual([
      market.id,
    ]);
    expect(ids(await transactions.list({ type: 'income' }))).toEqual([
      salary.id,
    ]);
    expect(ids(await transactions.list({ type: 'transfer' }))).toEqual([
      savings.id,
    ]);
  });

  it('filters by account, including incoming transfers', async () => {
    const { savings } = await seed();
    expect(ids(await transactions.list({ accountId: cash.id }))).toEqual([
      savings.id,
    ]);
    expect(await transactions.list({ accountId: bank.id })).toHaveLength(3);
  });

  it('filters by category', async () => {
    const { market, groceriesId } = await seed();
    expect(ids(await transactions.list({ categoryId: groceriesId }))).toEqual([
      market.id,
    ]);
  });

  it('filters by an inclusive date range', async () => {
    const { market, salary } = await seed();
    expect(
      ids(await transactions.list({ from: '2026-09-01', to: '2026-09-30' })),
    ).toEqual([salary.id, market.id]);
    expect(
      ids(await transactions.list({ from: '2026-09-25', to: '2026-09-25' })),
    ).toEqual([salary.id]);
  });

  it('searches payee, description and note, ignoring ASCII case', async () => {
    const { market, salary, savings } = await seed();
    expect(ids(await transactions.list({ search: 'torre' }))).toEqual([
      market.id,
    ]);
    expect(ids(await transactions.list({ search: 'SALARIO' }))).toEqual([
      salary.id,
    ]);
    expect(ids(await transactions.list({ search: 'semana' }))).toEqual([
      savings.id,
    ]);
    // Archived movements are never found.
    expect(await transactions.list({ search: 'viejo' })).toEqual([]);
  });

  it('matches %, _ and backslash literally in the search text', async () => {
    const { savings } = await seed();
    expect(ids(await transactions.list({ search: '100%' }))).toEqual([
      savings.id,
    ]);
    expect(ids(await transactions.list({ search: '%' }))).toEqual([savings.id]);
    expect(await transactions.list({ search: '_' })).toEqual([]);
    expect(await transactions.list({ search: '\\' })).toEqual([]);
  });

  it('combines filters and limits the result', async () => {
    const { market } = await seed();
    expect(
      ids(
        await transactions.list({
          type: 'expense',
          accountId: bank.id,
          from: '2026-09-01',
          search: 'super',
        }),
      ),
    ).toEqual([market.id]);
    expect(await transactions.list({ limit: 2 })).toHaveLength(2);
  });
});

describe('balances of every account at once', () => {
  it('match getAccountBalance for each account', async () => {
    await transactions.create(movement({ type: 'income', amountMinor: 5000 }));
    await transactions.create(
      movement({
        accountId: creditCard.id,
        cardId: visa.id,
        amountMinor: 45000,
      }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 45000,
        toAccountId: creditCard.id,
      }),
    );

    const balances = await transactions.listAccountBalances();
    for (const account of [bank, cash, creditCard]) {
      expect(balances[account.id]).toBe(
        await transactions.getAccountBalance(account.id),
      );
    }
    expect(balances[creditCard.id]).toBe(0);
    expect(balances[bank.id]).toBe(100000 + 5000 - 45000);
  });

  it('leave out archived accounts and archived movements', async () => {
    const spent = await transactions.create(
      movement({ accountId: bank.id, amountMinor: 700 }),
    );
    await transactions.softDelete(spent.id);
    await createAccountRepository(database.db).softDelete(cash.id);

    const balances = await transactions.listAccountBalances();
    expect(balances[cash.id]).toBeUndefined();
    expect(balances[bank.id]).toBe(100000);
  });
});

describe('credit card payment', () => {
  it('is a single transfer: the purchase stays the only expense', async () => {
    const purchase = await transactions.create(
      movement({
        accountId: creditCard.id,
        cardId: visa.id,
        amountMinor: 30000,
      }),
    );
    const payment = await transactions.create(
      movement({
        type: 'transfer',
        accountId: bank.id,
        toAccountId: creditCard.id,
        amountMinor: 30000,
      }),
    );

    expect(ids(await transactions.list({ type: 'expense' }))).toEqual([
      purchase.id,
    ]);
    expect(payment).toMatchObject({ categoryId: null, cardId: null });
    expect(await transactions.getAccountBalance(creditCard.id)).toBe(0);
    expect(await transactions.getAccountBalance(bank.id)).toBe(70000);
  });
});
