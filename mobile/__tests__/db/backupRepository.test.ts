import { createDatabase, prepareDatabase, type Database } from '../../src/core/db';
import { formatUuidV4 } from '../../src/core/db/ids';
import type { SqlExecutor } from '../../src/core/db/executor';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  InvalidBackupError,
  createBackupRepository,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type BackupFile,
  type ValidatedBackup,
} from '../../src/features/backup';
import {
  backupRepositories,
  derivedFigures,
  seedBackupFixture,
} from '../../src/features/backup/testing/backupFixture';
import type { Transaction } from '../../src/features/transactions';
import { nowIsoDateTime, todayLocalDate } from '../../src/shared/lib/dates';

const open: Database[] = [];

async function newDatabase(executor?: SqlExecutor): Promise<Database> {
  const database = await prepareDatabase(
    createDatabase(executor ?? createNodeSqliteExecutor()),
  );
  open.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map(database => database.close()));
});

/** Export → JSON text → full validation against `target`: what the app does. */
async function exportAndRead(
  source: Database,
  target: Database,
): Promise<ValidatedBackup> {
  const text = serializeBackup(
    await createBackupRepository(source).exportBackup(),
  );
  return parseBackup(
    text,
    await createBackupRepository(target).currentSchemaVersion(),
  );
}

/** The six tables of a database, as a backup holds them. */
async function snapshot(database: Database): Promise<BackupFile['data']> {
  return (await createBackupRepository(database).exportBackup()).data;
}

/** A backup that skipped parseBackup(): only to prove SQLite is a second barrier. */
function unchecked(backup: BackupFile): ValidatedBackup {
  return backup as ValidatedBackup;
}

describe('export', () => {
  it('includes every row of the six tables, archived ones included, exactly as stored', async () => {
    const database = await newDatabase();
    await seedBackupFixture(database);
    const repos = backupRepositories(database);

    const backup = await createBackupRepository(database).exportBackup();

    expect(backup).toMatchObject({
      format: 'control-gastos-backup',
      formatVersion: 1,
      schemaVersion: 4,
    });
    const byId = <T extends { id: string }>(rows: T[]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(backup.data.accounts)).toEqual(
      byId(await repos.accounts.list({ includeArchived: true })),
    );
    expect(summarizeBackup(backup).tables).toEqual({
      accounts: { total: 5, archived: 1 },
      // 14 default categories + 3 of the fixture, one archived.
      categories: { total: 17, archived: 1 },
      cards: { total: 2, archived: 1 },
      transactions: { total: 7, archived: 1 },
      budgets: { total: 2, archived: 1 },
      savingsGoals: { total: 2, archived: 1 },
    });
    const archived = backup.data.transactions.find(t => t.deletedAt !== null);
    expect(archived?.amountMinor).toBe(99999);
    expect(backup.data.transactions.some(t => t.status === 'pending')).toBe(
      true,
    );
  });

  it('writes nothing', async () => {
    const database = await newDatabase();
    await seedBackupFixture(database);
    const before = await snapshot(database);

    await createBackupRepository(database).exportBackup();

    expect(await snapshot(database)).toEqual(before);
  });

  it('produces a file that passes its own validation, also for a fresh install', async () => {
    const fresh = await newDatabase();
    const seeded = await newDatabase();
    await seedBackupFixture(seeded);

    await expect(exportAndRead(fresh, fresh)).resolves.toBeDefined();
    await expect(exportAndRead(seeded, fresh)).resolves.toBeDefined();
  });
});

describe('restore', () => {
  it('reproduces the six tables exactly in an empty database', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source);

    await createBackupRepository(target).restoreBackup(
      await exportAndRead(source, target),
    );

    expect(await snapshot(target)).toEqual(await snapshot(source));
  });

  it('replaces the existing data instead of merging it', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source, 'A');
    await seedBackupFixture(target, 'B');

    await createBackupRepository(target).restoreBackup(
      await exportAndRead(source, target),
    );

    const restored = await snapshot(target);
    expect(restored).toEqual(await snapshot(source));
    expect(restored.accounts.some(a => a.name.endsWith(' B'))).toBe(false);
  });

  it('keeps balances, month totals, budgets and savings progress identical', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source);

    await createBackupRepository(target).restoreBackup(
      await exportAndRead(source, target),
    );

    const figures = await derivedFigures(target);
    expect(figures).toEqual(await derivedFigures(source));
    // Sanity: the figures are not trivially empty.
    expect(Object.keys(figures.balances)).toHaveLength(4);
    expect(figures.savings.goals).toHaveLength(1);
    expect(figures.expenseByCategory.length).toBeGreaterThan(0);
  });

  it('adds no movement: the restored transactions are exactly the backup ones', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source);
    const backup = await exportAndRead(source, target);

    await createBackupRepository(target).restoreBackup(backup);

    const restored = (await snapshot(target)).transactions;
    expect(restored.map(t => t.id).sort()).toEqual(
      backup.data.transactions.map(t => t.id).sort(),
    );
  });

  it('can be repeated without duplicating anything', async () => {
    const database = await newDatabase();
    await seedBackupFixture(database);
    const original = await snapshot(database);
    const repository = createBackupRepository(database);

    for (let round = 0; round < 3; round++) {
      await repository.restoreBackup(await exportAndRead(database, database));
    }

    expect(await snapshot(database)).toEqual(original);
  });

  it('restores an archived goal and lets a new active goal use the same account', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    const fixture = await seedBackupFixture(source);

    await createBackupRepository(target).restoreBackup(
      await exportAndRead(source, target),
    );

    // The partial unique index ignores the archived goal of `bank`.
    await expect(
      backupRepositories(target).goals.create({
        accountId: fixture.bank.id,
        name: 'Otra meta',
        targetAmountMinor: 1000,
        targetDate: null,
      }),
    ).resolves.toMatchObject({ accountId: fixture.bank.id });
  });

  it('handles thousands of movements in one transaction', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    const { bank } = await seedBackupFixture(source);
    const now = nowIsoDateTime();
    const many: Transaction[] = Array.from({ length: 5000 }, (_, i) => ({
      id: formatUuidV4(i.toString(16).padStart(32, '0')),
      type: 'expense',
      amountMinor: i + 1,
      currency: 'GTQ',
      accountId: bank.id,
      toAccountId: null,
      categoryId: null,
      cardId: null,
      occurredAt: now,
      localDate: todayLocalDate(),
      description: null,
      payee: `Comercio ${i}`,
      note: null,
      source: 'manual',
      status: 'confirmed',
      externalRef: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));
    const base = await createBackupRepository(source).exportBackup();
    const big = parseBackup(
      serializeBackup({
        ...base,
        data: {
          ...base.data,
          transactions: [...base.data.transactions, ...many],
        },
      }),
      4,
    );

    await createBackupRepository(target).restoreBackup(big);

    expect((await snapshot(target)).transactions).toHaveLength(5007);
  });
});

describe('atomicity: a failed restore leaves the current data untouched', () => {
  /** node:sqlite executor that fails the first INSERT into `table` once armed. */
  function failingExecutor(table: string) {
    const executor = createNodeSqliteExecutor();
    const state = { armed: false };
    return {
      state,
      executor: {
        ...executor,
        async execute(sql: string, params: readonly unknown[]) {
          if (state.armed && sql.startsWith(`insert into "${table}"`)) {
            throw new Error('Simulated write failure');
          }
          return executor.execute(sql, params);
        },
      } satisfies SqlExecutor,
    };
  }

  it.each(['transactions', 'savings_goals'])(
    'rolls back when inserting into %s fails',
    async table => {
      const source = await newDatabase();
      await seedBackupFixture(source, 'A');
      const { executor, state } = failingExecutor(table);
      const target = await newDatabase(executor);
      await seedBackupFixture(target, 'B');
      const before = await snapshot(target);
      const figures = await derivedFigures(target);
      const backup = await exportAndRead(source, target);

      state.armed = true;
      expect(
        await sqliteErrorMessage(
          createBackupRepository(target).restoreBackup(backup),
        ),
      ).toBe('Simulated write failure');
      state.armed = false;

      expect(await snapshot(target)).toEqual(before);
      expect(await derivedFigures(target)).toEqual(figures);
    },
  );

  it('rolls back when SQLite rejects a duplicate active budget (partial unique index)', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source, 'A');
    await seedBackupFixture(target, 'B');
    const before = await snapshot(target);
    const backup = await createBackupRepository(source).exportBackup();
    const active = backup.data.budgets.find(b => b.deletedAt === null)!;
    const forged = unchecked({
      ...backup,
      data: {
        ...backup.data,
        budgets: [
          ...backup.data.budgets,
          { ...active, id: formatUuidV4('f'.repeat(32)) },
        ],
      },
    });

    expect(
      await sqliteErrorMessage(
        createBackupRepository(target).restoreBackup(forged),
      ),
    ).toMatch(/UNIQUE constraint failed: budgets/);
    expect(await snapshot(target)).toEqual(before);
  });

  it('rolls back when SQLite rejects a broken reference (foreign key)', async () => {
    const source = await newDatabase();
    const target = await newDatabase();
    await seedBackupFixture(source, 'A');
    await seedBackupFixture(target, 'B');
    const before = await snapshot(target);
    const backup = await createBackupRepository(source).exportBackup();
    const [first, ...rest] = backup.data.transactions;
    const forged = unchecked({
      ...backup,
      data: {
        ...backup.data,
        transactions: [
          { ...first, accountId: formatUuidV4('a'.repeat(32)) },
          ...rest,
        ],
      },
    });

    expect(
      await sqliteErrorMessage(
        createBackupRepository(target).restoreBackup(forged),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);
    expect(await snapshot(target)).toEqual(before);
  });

  it('rejects a backup of another schema version inside the transaction', async () => {
    const target = await newDatabase();
    await seedBackupFixture(target);
    const before = await snapshot(target);
    const backup = await createBackupRepository(target).exportBackup();

    await expect(
      createBackupRepository(target).restoreBackup(
        unchecked({ ...backup, schemaVersion: 3 }),
      ),
    ).rejects.toBeInstanceOf(InvalidBackupError);
    expect(await snapshot(target)).toEqual(before);
  });

  it('never reaches the database with a file that fails validation', async () => {
    const target = await newDatabase();
    await seedBackupFixture(target);
    const before = await snapshot(target);
    const text = serializeBackup(
      await createBackupRepository(target).exportBackup(),
    );

    for (const invalid of [
      '',
      '{"format":',
      '{"format":"otro"}',
      text.replace('"formatVersion":1', '"formatVersion":2'),
      text.replace(/"amountMinor":(\d+)/, '"amountMinor":$1.5'),
    ]) {
      expect(() => parseBackup(invalid, 4)).toThrow(InvalidBackupError);
    }
    expect(await snapshot(target)).toEqual(before);
  });
});

describe('the in-memory test database', () => {
  it('starts with the default categories that a restore replaces', async () => {
    const database = await createTestDatabase();
    open.push(database);
    expect((await snapshot(database)).categories).toHaveLength(14);
  });
});
