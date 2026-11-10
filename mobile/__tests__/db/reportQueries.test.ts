import {
  transactions as transactionsTable,
  type Database,
} from '../../src/core/db';
import { formatUuidV4 } from '../../src/core/db/ids';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import { createBudgetRepository } from '../../src/features/budgets/data/budgetRepository';
import { buildBudgetOverview } from '../../src/features/budgets/domain/budgetProgress';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';
import { summarizeByCurrency } from '../../src/features/dashboard/domain/dashboardSummary';
import { buildMonthlyReport } from '../../src/features/reports/domain/monthlyReport';
import { transactionToInsert } from '../../src/features/transactions/data/transactionMappers';
import {
  createTransactionRepository,
  type LocalDateRange,
  type NewTransaction,
  type TransactionRepository,
} from '../../src/features/transactions';
import { monthRangeOf } from '../../src/shared/lib/dates';

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

/** The report exactly as useMonthlyReport builds it, over the real repository. */
async function reportOf(period: LocalDateRange) {
  const [dailyTotals, categoryTotals, counts] = await Promise.all([
    transactions.listDailyTotals(period),
    transactions.listExpenseTotalsByCategory(period),
    transactions.listMovementCounts(period),
  ]);
  return buildMonthlyReport({
    dailyTotals,
    categoryTotals,
    counts,
    primaryCurrency: 'GTQ',
  });
}

describe('listMovementCounts', () => {
  it('is empty without movements', async () => {
    expect(await transactions.listMovementCounts(OCTOBER)).toEqual([]);
  });

  it('counts income and expenses per currency, never transfers', async () => {
    await transactions.create(movement({}));
    await transactions.create(movement({ categoryId: groceries.id }));
    await transactions.create(
      movement({ type: 'income', amountMinor: 900000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({ type: 'transfer', toAccountId: savings.id }),
    );
    await transactions.create(
      movement({ currency: 'USD', accountId: dollars.id }),
    );

    expect(await transactions.listMovementCounts(OCTOBER)).toEqual([
      { type: 'expense', currency: 'GTQ', count: 2 },
      { type: 'income', currency: 'GTQ', count: 1 },
      { type: 'expense', currency: 'USD', count: 1 },
    ]);
  });

  it('leaves out archived movements and keeps pending ones, like the totals', async () => {
    const archived = await transactions.create(movement({}));
    await transactions.softDelete(archived.id);
    await transactions.create(movement({ status: 'pending' }));

    expect(await transactions.listMovementCounts(OCTOBER)).toEqual([
      { type: 'expense', currency: 'GTQ', count: 1 },
    ]);
  });
});

describe('monthly report over SQLite', () => {
  it('reports income, expenses, net balance and counts of the month', async () => {
    await transactions.create(
      movement({ type: 'income', amountMinor: 1250000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({ amountMinor: 45075, categoryId: groceries.id }),
    );
    await transactions.create(
      movement({
        amountMinor: 999,
        categoryId: food.id,
        localDate: '2026-10-20',
      }),
    );

    const [report] = await reportOf(OCTOBER);

    expect(report).toMatchObject({
      currency: 'GTQ',
      incomeMinor: 1250000,
      expenseMinor: 46074,
      netMinor: 1203926,
      incomeCount: 1,
      expenseCount: 2,
    });
    expect(report.days.map(day => day.localDate)).toEqual([
      '2026-10-05',
      '2026-10-20',
    ]);
  });

  it('is empty for a month without movements', async () => {
    await transactions.create(movement({}));

    expect(await reportOf(monthRangeOf('2026-09-01'))).toEqual([]);
  });

  it('has a negative net balance when the month only has expenses', async () => {
    await transactions.create(movement({ amountMinor: 30000 }));

    const [report] = await reportOf(OCTOBER);

    expect(report.incomeMinor).toBe(0);
    expect(report.incomeCount).toBe(0);
    expect(report.netMinor).toBe(-30000);
  });

  it('has no categories when the month only has income', async () => {
    await transactions.create(
      movement({ type: 'income', amountMinor: 500000, categoryId: salary.id }),
    );

    const [report] = await reportOf(OCTOBER);

    expect(report.expenseMinor).toBe(0);
    expect(report.expenseCount).toBe(0);
    expect(report.netMinor).toBe(500000);
    expect(report.categories).toEqual([]);
  });

  it('leaves transfers out: a month with only transfers has nothing to report', async () => {
    await transactions.create(
      movement({ type: 'transfer', toAccountId: savings.id, amountMinor: 1 }),
    );

    expect(await reportOf(OCTOBER)).toEqual([]);
  });

  it('counts a credit card purchase once, not again when the card is paid', async () => {
    await transactions.create(
      movement({
        accountId: creditCard.id,
        cardId: visa.id,
        categoryId: groceries.id,
        amountMinor: 50000,
      }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        toAccountId: creditCard.id,
        amountMinor: 50000,
        localDate: '2026-10-25',
      }),
    );

    const [report] = await reportOf(OCTOBER);

    expect(report.expenseMinor).toBe(50000);
    expect(report.expenseCount).toBe(1);
    expect(report.categories).toEqual([
      { categoryId: groceries.id, totalMinor: 50000 },
    ]);
  });

  it('leaves archived movements out', async () => {
    const archived = await transactions.create(movement({ amountMinor: 777 }));
    await transactions.softDelete(archived.id);
    await transactions.create(movement({ amountMinor: 100 }));

    const [report] = await reportOf(OCTOBER);

    expect(report.expenseMinor).toBe(100);
    expect(report.expenseCount).toBe(1);
  });

  it('includes the first and last day of the month and nothing around them', async () => {
    for (const localDate of [
      '2025-12-31',
      '2026-01-01',
      '2026-01-31',
      '2026-02-01',
    ]) {
      await transactions.create(
        movement({
          localDate,
          occurredAt: `${localDate}T12:00:00.000Z`,
          amountMinor: 100,
        }),
      );
    }

    const [january] = await reportOf(monthRangeOf('2026-01-01'));
    const [december] = await reportOf(monthRangeOf('2026-01-01', 1));

    expect(january.days.map(day => day.localDate)).toEqual([
      '2026-01-01',
      '2026-01-31',
    ]);
    expect(january.expenseCount).toBe(2);
    expect(december.days.map(day => day.localDate)).toEqual(['2025-12-31']);
  });

  it('keeps archived categories in the months they were used', async () => {
    await transactions.create(
      movement({ amountMinor: 2000, categoryId: food.id }),
    );
    await createCategoryRepository(database.db).softDelete(food.id);

    const [report] = await reportOf(OCTOBER);

    expect(report.categories).toEqual([
      { categoryId: food.id, totalMinor: 2000 },
    ]);
  });

  it('never adds currencies together', async () => {
    await transactions.create(movement({ amountMinor: 1000 }));
    await transactions.create(
      movement({ currency: 'USD', accountId: dollars.id, amountMinor: 2000 }),
    );

    const reports = await reportOf(OCTOBER);

    expect(
      reports.map(r => [r.currency, r.expenseMinor, r.expenseCount]),
    ).toEqual([
      ['GTQ', 1000, 1],
      ['USD', 2000, 1],
    ]);
  });

  it('agrees with the dashboard and the budgets for the same month', async () => {
    await transactions.create(
      movement({ type: 'income', amountMinor: 900000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({ amountMinor: 30000, categoryId: groceries.id }),
    );
    await transactions.create(
      movement({
        accountId: creditCard.id,
        cardId: visa.id,
        amountMinor: 12000,
        categoryId: groceries.id,
      }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        toAccountId: creditCard.id,
        amountMinor: 1,
      }),
    );
    await transactions.create(movement({ amountMinor: 500 }));
    const budget = await createBudgetRepository(database.db).create({
      categoryId: groceries.id,
      currency: 'GTQ',
      amountMinor: 100000,
    });

    const [report] = await reportOf(OCTOBER);
    const [dashboard] = summarizeByCurrency({
      accounts: [],
      balances: {},
      dailyTotals: await transactions.listDailyTotals(OCTOBER),
      categoryTotals: await transactions.listExpenseTotalsByCategory(OCTOBER),
      primaryCurrency: 'GTQ',
    });
    const overview = buildBudgetOverview(
      [budget],
      await transactions.listExpenseTotalsByCategory(OCTOBER),
      OCTOBER,
    );

    expect(report.incomeMinor).toBe(dashboard.incomeMinor);
    expect(report.expenseMinor).toBe(dashboard.expenseMinor);
    expect(report.categories).toEqual(dashboard.categories);
    expect(report.days).toEqual(dashboard.days);
    expect(overview.budgets[0].spentMinor).toBe(
      report.categories.find(c => c.categoryId === groceries.id)?.totalMinor,
    );
    expect(report.expenseMinor).toBe(42500);
  });
});

describe('monthly report with a large history', () => {
  it('aggregates tens of thousands of movements in SQL with exact totals', async () => {
    const now = '2026-10-05T18:00:00.000Z';
    // 36 000 movements over 2026 (12 months × 3 000): income, expense and transfer.
    const rows = Array.from({ length: 36000 }, (_, i) => {
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      const type = (['income', 'expense', 'transfer'] as const)[
        Math.floor(i / 12) % 3
      ];
      return transactionToInsert({
        id: formatUuidV4(i.toString(16).padStart(32, '0')),
        type,
        amountMinor: i + 1,
        currency: 'GTQ',
        accountId: bank.id,
        toAccountId: type === 'transfer' ? savings.id : null,
        categoryId: type === 'expense' ? groceries.id : null,
        cardId: null,
        occurredAt: now,
        localDate: `2026-${month}-${day}`,
        description: null,
        payee: null,
        note: null,
        source: 'manual',
        status: 'confirmed',
        externalRef: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    });
    for (let start = 0; start < rows.length; start += 500) {
      await database.db
        .insert(transactionsTable)
        .values(rows.slice(start, start + 500));
    }
    // Independent oracle: the same figures computed from the generated rows.
    const october = rows.filter(row => row.localDate.startsWith('2026-10'));
    const sumOf = (type: string) =>
      october
        .filter(row => row.type === type)
        .reduce((sum, row) => sum + row.amountMinor, 0);

    const [report] = await reportOf(OCTOBER);

    expect(report.incomeMinor).toBe(sumOf('income'));
    expect(report.expenseMinor).toBe(sumOf('expense'));
    expect(report.incomeCount).toBe(1000);
    expect(report.expenseCount).toBe(1000);
    expect(report.categories).toEqual([
      { categoryId: groceries.id, totalMinor: sumOf('expense') },
    ]);
  });
});
