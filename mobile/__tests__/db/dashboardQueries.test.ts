import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';
import {
  createTransactionRepository,
  type NewTransaction,
  type TransactionRepository,
} from '../../src/features/transactions';

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

let database: Database;
let transactions: TransactionRepository;
let bank: Account;
let savings: Account;
let creditCard: Account;
let dollars: Account;
let visa: Card;
let groceries: Category;
let food: Category;
let salary: Category;

beforeEach(async () => {
  database = await createTestDatabase();
  const accounts = createAccountRepository(database.db);
  transactions = createTransactionRepository(database.db);

  bank = await accounts.create({
    name: 'Banco',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 500000,
  });
  savings = await accounts.create({
    name: 'Ahorro',
    type: 'savings',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  creditCard = await accounts.create({
    name: 'Crédito',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  dollars = await accounts.create({
    name: 'Dólares',
    type: 'bank',
    currency: 'USD',
    initialBalanceMinor: 0,
  });
  visa = await createCardRepository(database.db).create({
    accountId: creditCard.id,
    alias: 'Visa',
    last4: '4242',
    network: 'visa',
  });
  const all = await createCategoryRepository(database.db).list();
  const named = (name: string) => all.find(c => c.name === name)!;
  groceries = named('Supermercado');
  food = named('Alimentación');
  salary = named('Salario');
});

afterEach(async () => {
  await database.close();
});

function movement(fields: Partial<NewTransaction>): NewTransaction {
  return {
    type: 'expense',
    amountMinor: 1000,
    currency: 'GTQ',
    accountId: bank.id,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    occurredAt: '2026-10-05T18:00:00.000Z',
    localDate: '2026-10-05',
    description: null,
    payee: null,
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
    ...fields,
  };
}

describe('listDailyTotals', () => {
  it('is empty without movements', async () => {
    expect(await transactions.listDailyTotals(OCTOBER)).toEqual([]);
  });

  it('sums income and expenses per day with exact integers', async () => {
    await transactions.create(movement({ amountMinor: 45075 }));
    await transactions.create(movement({ amountMinor: 1 }));
    await transactions.create(
      movement({ type: 'income', amountMinor: 1250000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({ amountMinor: 999, localDate: '2026-10-07' }),
    );

    expect(await transactions.listDailyTotals(OCTOBER)).toEqual([
      {
        localDate: '2026-10-05',
        type: 'expense',
        currency: 'GTQ',
        totalMinor: 45076,
      },
      {
        localDate: '2026-10-05',
        type: 'income',
        currency: 'GTQ',
        totalMinor: 1250000,
      },
      {
        localDate: '2026-10-07',
        type: 'expense',
        currency: 'GTQ',
        totalMinor: 999,
      },
    ]);
  });

  it('leaves transfers out: they are neither income nor expense', async () => {
    await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 100000,
        toAccountId: savings.id,
      }),
    );

    expect(await transactions.listDailyTotals(OCTOBER)).toEqual([]);
  });

  it('counts a credit card purchase once, not again when the card is paid', async () => {
    await transactions.create(
      movement({
        amountMinor: 50000,
        accountId: creditCard.id,
        cardId: visa.id,
        categoryId: groceries.id,
      }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 50000,
        accountId: bank.id,
        toAccountId: creditCard.id,
        localDate: '2026-10-20',
      }),
    );

    const totals = await transactions.listDailyTotals(OCTOBER);
    expect(totals).toEqual([
      expect.objectContaining({ type: 'expense', totalMinor: 50000 }),
    ]);
  });

  it('only includes the range, both ends inclusive', async () => {
    await transactions.create(movement({ localDate: '2026-09-30' }));
    await transactions.create(movement({ localDate: '2026-10-01' }));
    await transactions.create(movement({ localDate: '2026-10-31' }));
    await transactions.create(movement({ localDate: '2026-11-01' }));

    const days = (await transactions.listDailyTotals(OCTOBER)).map(
      total => total.localDate,
    );
    expect(days).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('excludes archived movements', async () => {
    const archived = await transactions.create(movement({ amountMinor: 700 }));
    await transactions.create(movement({ amountMinor: 300 }));
    await transactions.softDelete(archived.id);

    expect(await transactions.listDailyTotals(OCTOBER)).toEqual([
      expect.objectContaining({ totalMinor: 300 }),
    ]);
  });

  it('includes pending movements, like the balances do', async () => {
    await transactions.create(
      movement({ status: 'pending', amountMinor: 400 }),
    );

    expect(await transactions.listDailyTotals(OCTOBER)).toEqual([
      expect.objectContaining({ totalMinor: 400 }),
    ]);
  });

  it('never adds different currencies together', async () => {
    await transactions.create(movement({ amountMinor: 1000 }));
    await transactions.create(
      movement({ amountMinor: 2000, currency: 'USD', accountId: dollars.id }),
    );

    const totals = await transactions.listDailyTotals(OCTOBER);
    expect(totals).toHaveLength(2);
    expect(totals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'GTQ', totalMinor: 1000 }),
        expect.objectContaining({ currency: 'USD', totalMinor: 2000 }),
      ]),
    );
  });
});

describe('listExpenseTotalsByCategory', () => {
  it('groups expenses by category, largest first', async () => {
    await transactions.create(
      movement({ amountMinor: 3000, categoryId: food.id }),
    );
    await transactions.create(
      movement({ amountMinor: 5000, categoryId: groceries.id }),
    );
    await transactions.create(
      movement({ amountMinor: 4000, categoryId: food.id }),
    );
    await transactions.create(movement({ amountMinor: 100 }));

    expect(await transactions.listExpenseTotalsByCategory(OCTOBER)).toEqual([
      { categoryId: food.id, currency: 'GTQ', totalMinor: 7000 },
      { categoryId: groceries.id, currency: 'GTQ', totalMinor: 5000 },
      { categoryId: null, currency: 'GTQ', totalMinor: 100 },
    ]);
  });

  it('ignores income, transfers, archived movements and other months', async () => {
    await transactions.create(
      movement({ type: 'income', amountMinor: 9000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({ type: 'transfer', toAccountId: savings.id }),
    );
    const archived = await transactions.create(
      movement({ categoryId: food.id }),
    );
    await transactions.softDelete(archived.id);
    await transactions.create(
      movement({ categoryId: food.id, localDate: '2026-09-30' }),
    );

    expect(await transactions.listExpenseTotalsByCategory(OCTOBER)).toEqual([]);
  });

  it('keeps an archived category used by past movements', async () => {
    await transactions.create(
      movement({ amountMinor: 2500, categoryId: groceries.id }),
    );
    await createCategoryRepository(database.db).softDelete(groceries.id);

    expect(await transactions.listExpenseTotalsByCategory(OCTOBER)).toEqual([
      { categoryId: groceries.id, currency: 'GTQ', totalMinor: 2500 },
    ]);
  });
});
