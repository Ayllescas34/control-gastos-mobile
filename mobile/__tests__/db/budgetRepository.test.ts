/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sql } from 'drizzle-orm';
import {
  createDatabase,
  prepareDatabase,
  type Database,
} from '../../src/core/db';
import { migrate } from '../../src/core/db/migrate';
import migrations from '../../src/core/db/migrations/migrations';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import {
  buildBudgetOverview,
  createBudgetRepository,
  InvalidBudgetError,
  type BudgetRepository,
} from '../../src/features/budgets';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';
import {
  createTransactionRepository,
  type NewTransaction,
  type TransactionRepository,
} from '../../src/features/transactions';

const NOW = '2026-10-01T12:00:00.000Z';
const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

let database: Database;
let budgets: BudgetRepository;
let food: Category;
let groceries: Category;
let salary: Category;

beforeEach(async () => {
  database = await createTestDatabase();
  budgets = createBudgetRepository(database.db);
  const all = await createCategoryRepository(database.db).list();
  const named = (name: string) => all.find(c => c.name === name)!;
  food = named('Alimentación');
  groceries = named('Supermercado');
  salary = named('Salario');
});

afterEach(() => database.close());

const gtq = (categoryId: string, amountMinor = 200000) => ({
  categoryId,
  amountMinor,
  currency: 'GTQ',
});

describe('budgetRepository', () => {
  it('creates, reads and lists a budget', async () => {
    const created = await budgets.create(gtq(food.id));

    expect(created).toMatchObject({
      categoryId: food.id,
      amountMinor: 200000,
      currency: 'GTQ',
      deletedAt: null,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await budgets.getById(created.id)).toEqual(created);
    expect(await budgets.list()).toEqual([created]);
  });

  it('rejects invalid budgets before writing', async () => {
    const attempts = [
      [gtq(food.id, 0), 'amount_invalid'],
      [gtq(food.id, 10.5), 'amount_invalid'],
      [{ ...gtq(food.id), currency: 'gtq' }, 'currency_invalid'],
      [gtq('missing'), 'category_not_found'],
      [gtq(salary.id), 'category_not_expense'],
    ] as const;
    for (const [input, code] of attempts) {
      const error = await budgets.create(input).catch(e => e);
      expect(error).toBeInstanceOf(InvalidBudgetError);
      expect(error.errors).toContain(code);
    }
    expect(await budgets.list()).toEqual([]);
  });

  it('rejects a new budget for an archived category', async () => {
    await createCategoryRepository(database.db).softDelete(food.id);
    const error = await budgets.create(gtq(food.id)).catch(e => e);
    expect(error.errors).toEqual(['category_archived']);
  });

  it('allows one active budget per category and currency', async () => {
    await budgets.create(gtq(food.id));
    const error = await budgets.create(gtq(food.id, 5000)).catch(e => e);
    expect(error.errors).toEqual(['budget_duplicate']);
    // Another currency is another budget.
    await budgets.create({ ...gtq(food.id), currency: 'USD' });
    expect(await budgets.list()).toHaveLength(2);
  });

  it('updates only the limit and validates it', async () => {
    const created = await budgets.create(gtq(food.id));
    const updated = await budgets.update(created.id, { amountMinor: 150000 });

    expect(updated).toMatchObject({
      id: created.id,
      categoryId: food.id,
      currency: 'GTQ',
      amountMinor: 150000,
    });
    const error = await budgets
      .update(created.id, { amountMinor: -1 })
      .catch(e => e);
    expect(error.errors).toEqual(['amount_invalid']);
    expect((await budgets.getById(created.id))?.amountMinor).toBe(150000);
  });

  it('keeps editing a budget whose category was archived later', async () => {
    const created = await budgets.create(gtq(food.id));
    await createCategoryRepository(database.db).softDelete(food.id);

    expect(
      (await budgets.update(created.id, { amountMinor: 100 }))?.amountMinor,
    ).toBe(100);
    expect(await budgets.list()).toHaveLength(1);
  });

  it('archives without deleting and allows a new budget afterwards', async () => {
    const first = await budgets.create(gtq(food.id));

    expect(await budgets.softDelete(first.id)).toBe(true);
    expect(await budgets.softDelete(first.id)).toBe(false);
    expect(await budgets.getById(first.id)).toBeNull();
    expect(await budgets.update(first.id, { amountMinor: 1 })).toBeNull();
    expect(await budgets.list()).toEqual([]);
    expect(await budgets.list({ includeArchived: true })).toEqual([
      expect.objectContaining({ id: first.id, deletedAt: expect.any(String) }),
    ]);

    const second = await budgets.create(gtq(food.id, 90000));
    expect(await budgets.list()).toEqual([second]);
  });
});

describe('the database is a second barrier', () => {
  const insert = (
    id: string,
    categoryId: string,
    amount: unknown,
    currency = 'GTQ',
  ) =>
    database.db.run(sql`INSERT INTO budgets
      (id, category_id, amount_minor, currency, created_at, updated_at)
      VALUES (${id}, ${categoryId}, ${amount}, ${currency}, ${NOW}, ${NOW})`);

  it('checks the amount and the currency', async () => {
    expect(await sqliteErrorMessage(insert('a', food.id, 0))).toMatch(
      /budgets_amount_minor_check/,
    );
    expect(await sqliteErrorMessage(insert('b', food.id, 10.5))).toMatch(
      /budgets_amount_minor_check/,
    );
    expect(await sqliteErrorMessage(insert('c', food.id, 2 ** 53))).toMatch(
      /budgets_amount_minor_check/,
    );
    expect(await sqliteErrorMessage(insert('d', food.id, 100, 'gtq'))).toMatch(
      /budgets_currency_check/,
    );
  });

  it('requires an existing category and never lets it be deleted (RESTRICT)', async () => {
    expect(await sqliteErrorMessage(insert('a', 'missing', 100))).toMatch(
      /FOREIGN KEY constraint failed/,
    );
    await insert('b', food.id, 100);
    expect(
      await sqliteErrorMessage(
        database.db.run(sql`DELETE FROM categories WHERE id = ${food.id}`),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('allows one active row per category and currency (partial unique index)', async () => {
    await insert('a', food.id, 100);
    expect(await sqliteErrorMessage(insert('b', food.id, 200))).toMatch(
      /UNIQUE constraint failed/,
    );
    await database.db.run(
      sql`UPDATE budgets SET deleted_at = ${NOW} WHERE id = 'a'`,
    );
    await insert('c', food.id, 300);
  });
});

describe('spending', () => {
  let transactions: TransactionRepository;
  let bank: Account;
  let savings: Account;
  let credit: Account;
  let visa: Card;

  beforeEach(async () => {
    const accounts = createAccountRepository(database.db);
    transactions = createTransactionRepository(database.db);
    bank = await accounts.create({
      name: 'Banco',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 1000000,
    });
    savings = await accounts.create({
      name: 'Ahorro',
      type: 'savings',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    credit = await accounts.create({
      name: 'Crédito',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    visa = await createCardRepository(database.db).create({
      accountId: credit.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
  });

  function movement(fields: Partial<NewTransaction>): NewTransaction {
    return {
      type: 'expense',
      amountMinor: 1000,
      currency: 'GTQ',
      accountId: bank.id,
      toAccountId: null,
      categoryId: food.id,
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

  /** What the budgets screen computes: budgets plus the month's SQL expense totals. */
  async function overview() {
    return buildBudgetOverview(
      await budgets.list(),
      await transactions.listExpenseTotalsByCategory(OCTOBER),
      OCTOBER,
    );
  }

  async function spentOnFood() {
    const { budgets: progress } = await overview();
    return progress.find(p => p.budget.categoryId === food.id)?.spentMinor;
  }

  beforeEach(async () => {
    await budgets.create(gtq(food.id));
  });

  it('sums the expenses of the category in the month', async () => {
    await transactions.create(movement({ amountMinor: 50000 }));
    await transactions.create(movement({ amountMinor: 30000 }));
    await transactions.create(movement({ amountMinor: 20000 }));

    const [progress] = (await overview()).budgets;
    expect(progress).toMatchObject({
      spentMinor: 100000,
      remainingMinor: 100000,
      status: 'ok',
    });
  });

  it('ignores income and transfers, card payments included', async () => {
    await transactions.create(
      movement({ type: 'income', amountMinor: 900000, categoryId: salary.id }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        toAccountId: savings.id,
        categoryId: null,
      }),
    );
    await transactions.create(
      movement({ type: 'transfer', toAccountId: credit.id, categoryId: null }),
    );
    expect(await spentOnFood()).toBe(0);
  });

  it('counts a card purchase once, not its payment', async () => {
    await transactions.create(
      movement({ amountMinor: 50000, accountId: credit.id, cardId: visa.id }),
    );
    await transactions.create(
      movement({
        type: 'transfer',
        amountMinor: 50000,
        toAccountId: credit.id,
        categoryId: null,
      }),
    );
    expect(await spentOnFood()).toBe(50000);
  });

  it('excludes archived movements and other months', async () => {
    const archived = await transactions.create(movement({ amountMinor: 700 }));
    await transactions.softDelete(archived.id);
    await transactions.create(movement({ localDate: '2026-09-30' }));
    await transactions.create(movement({ localDate: '2026-11-01' }));
    await transactions.create(movement({ amountMinor: 300 }));
    expect(await spentOnFood()).toBe(300);
  });

  it('counts pending movements', async () => {
    await transactions.create(
      movement({ status: 'pending', amountMinor: 400 }),
    );
    expect(await spentOnFood()).toBe(400);
  });

  it('only counts the budget currency; other currencies stay without budget', async () => {
    const dollars = await createAccountRepository(database.db).create({
      name: 'Dólares',
      type: 'bank',
      currency: 'USD',
      initialBalanceMinor: 0,
    });
    await transactions.create(
      movement({ accountId: dollars.id, currency: 'USD', amountMinor: 10000 }),
    );

    const result = await overview();
    expect(result.budgets[0].spentMinor).toBe(0);
    expect(result.unbudgeted).toEqual([
      { categoryId: food.id, currency: 'USD', spentMinor: 10000 },
    ]);
  });

  it('keeps counting after the category is archived', async () => {
    await transactions.create(movement({ amountMinor: 2500 }));
    await createCategoryRepository(database.db).softDelete(food.id);
    expect(await spentOnFood()).toBe(2500);
  });

  it('keeps counting expenses of an archived account', async () => {
    const cash = await createAccountRepository(database.db).create({
      name: 'Efectivo',
      type: 'cash',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    await transactions.create(
      movement({ accountId: cash.id, amountMinor: 800 }),
    );
    await createAccountRepository(database.db).softDelete(cash.id);
    expect(await spentOnFood()).toBe(800);
  });

  it('stops counting for an archived budget', async () => {
    await transactions.create(movement({ amountMinor: 800 }));
    const [budget] = await budgets.list();
    await budgets.softDelete(budget.id);

    const result = await overview();
    expect(result.budgets).toEqual([]);
    expect(result.unbudgeted).toEqual([
      { categoryId: food.id, currency: 'GTQ', spentMinor: 800 },
    ]);
  });

  it('reports categories with spending and no budget, uncategorized included', async () => {
    await transactions.create(
      movement({ amountMinor: 4000, categoryId: groceries.id }),
    );
    await transactions.create(movement({ amountMinor: 100, categoryId: null }));
    expect((await overview()).unbudgeted).toEqual([
      { categoryId: groceries.id, currency: 'GTQ', spentMinor: 4000 },
      { categoryId: null, currency: 'GTQ', spentMinor: 100 },
    ]);
  });
});

describe('migration 0003 on an existing install', () => {
  it('adds budgets while keeping categories and movements', async () => {
    const upgraded = createDatabase(createNodeSqliteExecutor());
    await upgraded.db.run(sql`PRAGMA foreign_keys = ON`);
    const shipped = migrations.journal.entries.slice(0, 3);
    await migrate(upgraded, {
      journal: { entries: shipped },
      migrations: {
        m0000: migrations.migrations.m0000,
        m0001: migrations.migrations.m0001,
        m0002: migrations.migrations.m0002,
      },
    });
    await upgraded.db.run(
      sql`INSERT INTO accounts VALUES ('a', 'A', 'bank', 'GTQ', 0, ${NOW}, ${NOW}, NULL)`,
    );
    const [category] = await createCategoryRepository(upgraded.db).list({
      kind: 'expense',
    });
    await upgraded.db.run(sql`INSERT INTO transactions (
        id, type, amount_minor, currency, account_id, category_id, occurred_at,
        local_date, source, status, created_at, updated_at
      ) VALUES ('t', 'expense', 4575, 'GTQ', 'a', ${category.id}, ${NOW},
        '2026-10-01', 'manual', 'confirmed', ${NOW}, ${NOW})`);

    await migrate(upgraded, migrations);

    const [[amount]] = await upgraded.db.values<[number]>(
      sql`SELECT amount_minor FROM transactions WHERE id = 't'`,
    );
    expect(amount).toBe(4575);
    expect(await createCategoryRepository(upgraded.db).list()).toHaveLength(14);
    const created = await createBudgetRepository(upgraded.db).create(
      gtq(category.id),
    );
    expect(await createBudgetRepository(upgraded.db).list()).toEqual([created]);
    const [[applied]] = await upgraded.db.values<[string]>(
      sql`SELECT tag FROM schema_migrations WHERE idx = 3`,
    );
    expect(applied).toBe('0003_budgets');
    await upgraded.close();
  });
});

describe('persistence', () => {
  it('reads back, from a new connection, a budget written by an earlier one', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'control-gastos-'));
    const path = join(directory, 'control-gastos.db');
    const open = () =>
      prepareDatabase(
        createDatabase(createNodeSqliteExecutor(new DatabaseSync(path))),
      );
    try {
      const first = await open();
      const created = await createBudgetRepository(first.db).create(
        gtq(food.id),
      );
      await first.close();

      const second = await open();
      expect(
        await createBudgetRepository(second.db).getById(created.id),
      ).toEqual(created);
      await second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
