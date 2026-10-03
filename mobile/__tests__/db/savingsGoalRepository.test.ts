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
  AccountHasActiveSavingsGoalError,
  createAccountRepository,
  type Account,
  type AccountRepository,
} from '../../src/features/accounts';
import { createCategoryRepository } from '../../src/features/categories';
import {
  buildSavingsOverview,
  createSavingsGoalRepository,
  InvalidSavingsGoalError,
  type NewSavingsGoal,
  type SavingsGoalRepository,
} from '../../src/features/savings';
import {
  createTransactionRepository,
  type NewTransaction,
  type TransactionRepository,
} from '../../src/features/transactions';

const NOW = '2026-10-01T12:00:00.000Z';

let database: Database;
let goals: SavingsGoalRepository;
let accounts: AccountRepository;
let savings: Account;

beforeEach(async () => {
  database = await createTestDatabase();
  goals = createSavingsGoalRepository(database.db);
  accounts = createAccountRepository(database.db);
  savings = await accounts.create({
    name: 'Ahorros',
    type: 'savings',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
});

afterEach(() => database.close());

const laptop = (
  accountId: string,
  fields: Partial<NewSavingsGoal> = {},
): NewSavingsGoal => ({
  accountId,
  name: 'Laptop',
  targetAmountMinor: 1000000,
  targetDate: null,
  ...fields,
});

describe('savingsGoalRepository', () => {
  it('creates, reads and lists a goal', async () => {
    const created = await goals.create(
      laptop(savings.id, { name: '  Laptop  ', targetDate: '2026-12-15' }),
    );

    expect(created).toMatchObject({
      accountId: savings.id,
      name: 'Laptop',
      targetAmountMinor: 1000000,
      targetDate: '2026-12-15',
      deletedAt: null,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await goals.getById(created.id)).toEqual(created);
    expect(await goals.list()).toEqual([created]);
  });

  it('rejects invalid goals before writing', async () => {
    const attempts = [
      [laptop(savings.id, { name: ' ' }), 'name_required'],
      [laptop(savings.id, { name: 'a'.repeat(61) }), 'name_too_long'],
      [laptop(savings.id, { targetAmountMinor: 0 }), 'target_invalid'],
      [laptop(savings.id, { targetAmountMinor: 10.5 }), 'target_invalid'],
      [laptop(savings.id, { targetDate: '2026-02-30' }), 'target_date_invalid'],
      [laptop('missing'), 'account_not_found'],
    ] as const;
    for (const [input, code] of attempts) {
      const error = await goals.create(input).catch(e => e);
      expect(error).toBeInstanceOf(InvalidSavingsGoalError);
      expect(error.errors).toContain(code);
    }
    expect(await goals.list()).toEqual([]);
  });

  it('rejects a credit card account', async () => {
    const credit = await accounts.create({
      name: 'Visa',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const error = await goals.create(laptop(credit.id)).catch(e => e);
    expect(error.errors).toEqual(['account_type_invalid']);
  });

  it('rejects an archived account', async () => {
    const old = await accounts.create({
      name: 'Vieja',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    await accounts.softDelete(old.id);
    const error = await goals.create(laptop(old.id)).catch(e => e);
    expect(error.errors).toEqual(['account_archived']);
  });

  it('allows one active goal per account, and the same name on another account', async () => {
    await goals.create(laptop(savings.id));
    const error = await goals
      .create(laptop(savings.id, { name: 'Viaje' }))
      .catch(e => e);
    expect(error.errors).toEqual(['account_has_goal']);

    const bank = await accounts.create({
      name: 'Banco',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    await goals.create(laptop(bank.id));
    expect(await goals.list()).toHaveLength(2);
  });

  it('updates name, target and date, never the account', async () => {
    const created = await goals.create(laptop(savings.id));
    const updated = await goals.update(created.id, {
      name: 'Laptop nueva',
      targetAmountMinor: 1200000,
      targetDate: '2027-01-31',
    });
    expect(updated).toMatchObject({
      id: created.id,
      accountId: savings.id,
      name: 'Laptop nueva',
      targetAmountMinor: 1200000,
      targetDate: '2027-01-31',
    });

    // Clearing the date and keeping the rest.
    expect(await goals.update(created.id, { targetDate: null })).toMatchObject({
      targetDate: null,
      name: 'Laptop nueva',
    });

    const error = await goals
      .update(created.id, { targetAmountMinor: -1 })
      .catch(e => e);
    expect(error.errors).toEqual(['target_invalid']);
    expect((await goals.getById(created.id))?.targetAmountMinor).toBe(1200000);
  });

  it('archives without deleting; an archived goal cannot be edited and frees the account', async () => {
    const first = await goals.create(laptop(savings.id));

    expect(await goals.softDelete(first.id)).toBe(true);
    expect(await goals.softDelete(first.id)).toBe(false);
    expect(await goals.getById(first.id)).toBeNull();
    expect(await goals.update(first.id, { name: 'Otra' })).toBeNull();
    expect(await goals.list()).toEqual([]);
    expect(await goals.list({ includeArchived: true })).toEqual([
      expect.objectContaining({ id: first.id, deletedAt: expect.any(String) }),
    ]);

    const second = await goals.create(laptop(savings.id, { name: 'Viaje' }));
    expect(await goals.list()).toEqual([second]);
  });
});

describe('the database is a second barrier', () => {
  const insert = (
    id: string,
    accountId: string,
    fields: { name?: string; amount?: unknown; date?: string | null } = {},
  ) =>
    database.db.run(sql`INSERT INTO savings_goals
      (id, account_id, name, target_amount_minor, target_date, created_at, updated_at)
      VALUES (${id}, ${accountId}, ${fields.name ?? 'Meta'}, ${
      fields.amount ?? 100
    }, ${fields.date ?? null}, ${NOW}, ${NOW})`);

  it('checks the name, the target and the date', async () => {
    expect(
      await sqliteErrorMessage(insert('a', savings.id, { name: '   ' })),
    ).toMatch(/savings_goals_name_check/);
    for (const amount of [0, -1, 10.5, 2 ** 53]) {
      expect(
        await sqliteErrorMessage(insert('b', savings.id, { amount })),
      ).toMatch(/savings_goals_target_amount_minor_check/);
    }
    expect(
      await sqliteErrorMessage(insert('c', savings.id, { date: '15/12/2026' })),
    ).toMatch(/savings_goals_target_date_check/);
    await insert('d', savings.id, { date: '2026-12-15' });
  });

  it('requires an existing account and never lets it be deleted (RESTRICT)', async () => {
    expect(await sqliteErrorMessage(insert('a', 'missing'))).toMatch(
      /FOREIGN KEY constraint failed/,
    );
    await insert('b', savings.id);
    expect(
      await sqliteErrorMessage(
        database.db.run(sql`DELETE FROM accounts WHERE id = ${savings.id}`),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('allows one active row per account (partial unique index), any name', async () => {
    await insert('a', savings.id, { name: 'Laptop' });
    expect(
      await sqliteErrorMessage(insert('b', savings.id, { name: 'Viaje' })),
    ).toMatch(/UNIQUE constraint failed/);
    await database.db.run(
      sql`UPDATE savings_goals SET deleted_at = ${NOW} WHERE id = 'a'`,
    );
    await insert('c', savings.id, { name: 'Laptop' });

    const bank = await accounts.create({
      name: 'Banco',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    // No unique name: the same name is fine on another account.
    await insert('d', bank.id, { name: 'Laptop' });
  });
});

describe('saved amount = the account balance', () => {
  let transactions: TransactionRepository;
  let checking: Account;

  beforeEach(async () => {
    transactions = createTransactionRepository(database.db);
    checking = await accounts.create({
      name: 'Monetaria',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 5000000,
    });
    await goals.create(laptop(savings.id));
  });

  function movement(fields: Partial<NewTransaction>): NewTransaction {
    return {
      type: 'transfer',
      amountMinor: 1000,
      currency: 'GTQ',
      accountId: checking.id,
      toAccountId: savings.id,
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

  /** What the savings screen computes: goals plus every account balance. */
  async function overview() {
    return buildSavingsOverview(
      await goals.list(),
      await transactions.listAccountBalances(),
      await accounts.list({ includeArchived: true }),
    );
  }

  async function saved() {
    const [progress] = (await overview()).goals;
    return progress.savedMinor;
  }

  async function categoryId(name: string) {
    const all = await createCategoryRepository(database.db).list();
    return all.find(c => c.name === name)!.id;
  }

  it('includes the initial balance of the account', async () => {
    await accounts.update(savings.id, { initialBalanceMinor: 300000 });
    expect(await saved()).toBe(300000);
  });

  it('grows with a transfer in, which is neither expense nor income', async () => {
    await transactions.create(movement({ amountMinor: 450000 }));

    const result = await overview();
    expect(result.goals[0]).toMatchObject({
      savedMinor: 450000,
      remainingMinor: 550000,
      status: 'in_progress',
      currency: 'GTQ',
    });
    expect(
      await transactions.listExpenseTotalsByCategory({
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    ).toEqual([]);
    // The transfer is the only movement: no extra transaction for the goal.
    expect(await transactions.list()).toHaveLength(1);
  });

  it('shrinks with a transfer out (a withdrawal)', async () => {
    await transactions.create(movement({ amountMinor: 500000 }));
    await transactions.create(
      movement({
        amountMinor: 100000,
        accountId: savings.id,
        toAccountId: checking.id,
      }),
    );
    expect(await saved()).toBe(400000);
  });

  it('grows with income and shrinks with an expense from the account', async () => {
    await transactions.create(
      movement({
        type: 'income',
        accountId: savings.id,
        toAccountId: null,
        categoryId: await categoryId('Salario'),
        amountMinor: 200000,
      }),
    );
    await transactions.create(
      movement({
        type: 'expense',
        accountId: savings.id,
        toAccountId: null,
        categoryId: await categoryId('Alimentación'),
        amountMinor: 50000,
      }),
    );
    expect(await saved()).toBe(150000);
  });

  it('excludes archived movements and counts pending ones', async () => {
    const archived = await transactions.create(
      movement({ amountMinor: 900000 }),
    );
    await transactions.softDelete(archived.id);
    await transactions.create(
      movement({ amountMinor: 70000, status: 'pending' }),
    );
    expect(await saved()).toBe(70000);
  });

  it('reaches and surpasses the target', async () => {
    await transactions.create(movement({ amountMinor: 1000000 }));
    expect((await overview()).goals[0].status).toBe('reached');
    await transactions.create(movement({ amountMinor: 250000 }));
    expect((await overview()).goals[0]).toMatchObject({
      savedMinor: 1250000,
      remainingMinor: -250000,
      status: 'reached',
    });
  });

  it('keeps currencies apart: a USD goal measures a USD account', async () => {
    const dollars = await accounts.create({
      name: 'Dólares',
      type: 'savings',
      currency: 'USD',
      initialBalanceMinor: 30000,
    });
    await goals.create(
      laptop(dollars.id, { name: 'Viaje', targetAmountMinor: 100000 }),
    );
    await transactions.create(movement({ amountMinor: 450000 }));

    const result = await overview();
    expect(
      result.goals.map(p => [p.goal.name, p.currency, p.savedMinor]),
    ).toEqual([
      ['Laptop', 'GTQ', 450000],
      ['Viaje', 'USD', 30000],
    ]);
    // Transfers never mix currencies.
    expect(
      await transactions
        .create(movement({ toAccountId: dollars.id }))
        .catch(e => e.errors),
    ).toContain('currency_mismatch');
  });

  it('blocks archiving the account while the goal is active', async () => {
    await expect(accounts.softDelete(savings.id)).rejects.toBeInstanceOf(
      AccountHasActiveSavingsGoalError,
    );
    expect(await saved()).toBe(0);
  });
});

describe('migration 0004 on an existing install', () => {
  it('adds savings goals while keeping accounts and movements', async () => {
    const upgraded = createDatabase(createNodeSqliteExecutor());
    await upgraded.db.run(sql`PRAGMA foreign_keys = ON`);
    await migrate(upgraded, {
      journal: { entries: migrations.journal.entries.slice(0, 4) },
      migrations: {
        m0000: migrations.migrations.m0000,
        m0001: migrations.migrations.m0001,
        m0002: migrations.migrations.m0002,
        m0003: migrations.migrations.m0003,
      },
    });
    await upgraded.db.run(
      sql`INSERT INTO accounts VALUES ('a', 'Ahorros', 'savings', 'GTQ', 12345, ${NOW}, ${NOW}, NULL)`,
    );

    await migrate(upgraded, migrations);

    const goalsAfter = createSavingsGoalRepository(upgraded.db);
    const created = await goalsAfter.create(laptop('a'));
    expect(await goalsAfter.list()).toEqual([created]);
    expect(
      await createTransactionRepository(upgraded.db).getAccountBalance('a'),
    ).toBe(12345);
    const [[applied]] = await upgraded.db.values<[string]>(
      sql`SELECT tag FROM schema_migrations WHERE idx = 4`,
    );
    expect(applied).toBe('0004_savings_goals');
    await upgraded.close();
  });
});

describe('persistence', () => {
  it('reads back, from a new connection, a goal and its balance written by an earlier one', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'control-gastos-'));
    const path = join(directory, 'control-gastos.db');
    const open = () =>
      prepareDatabase(
        createDatabase(createNodeSqliteExecutor(new DatabaseSync(path))),
      );
    try {
      const first = await open();
      const account = await createAccountRepository(first.db).create({
        name: 'Ahorros',
        type: 'savings',
        currency: 'GTQ',
        initialBalanceMinor: 450000,
      });
      const created = await createSavingsGoalRepository(first.db).create(
        laptop(account.id),
      );
      await first.close();

      const second = await open();
      expect(
        await createSavingsGoalRepository(second.db).getById(created.id),
      ).toEqual(created);
      expect(
        (await createTransactionRepository(second.db).listAccountBalances())[
          account.id
        ],
      ).toBe(450000);
      await second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
