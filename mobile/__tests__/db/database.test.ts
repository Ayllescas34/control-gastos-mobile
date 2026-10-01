import { open } from '@op-engineering/op-sqlite';
import { eq, sql } from 'drizzle-orm';
import {
  accounts,
  createDatabase,
  generateId,
  prepareDatabase,
  type Database,
} from '../../src/core/db';
import { createOpSqliteExecutor } from '../../src/core/db/executor';
import { migrate, type MigrationBundle } from '../../src/core/db/migrate';
import migrations from '../../src/core/db/migrations/migrations';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';

const NOW = '2026-09-30T12:00:00.000Z';

function accountValues(id: string, initialBalanceMinor = 0) {
  return {
    id,
    name: `Cuenta ${id}`,
    type: 'bank' as const,
    currency: 'GTQ',
    initialBalanceMinor,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

async function countAccounts(database: Database): Promise<number> {
  const [[count]] = await database.db.values<[number]>(
    sql`SELECT count(*) FROM accounts`,
  );
  return count;
}

describe('op-sqlite → executor → sqlite-proxy → Drizzle → SQLite', () => {
  let database: Database;

  beforeEach(async () => {
    // `open` is op-sqlite's API; under Jest it is backed by node:sqlite (see __mocks__).
    const connection = open({ name: 'test.db' });
    database = await prepareDatabase(
      createDatabase(createOpSqliteExecutor(connection)),
    );
  });

  afterEach(() => database.close());

  it('runs INSERT, SELECT and UPDATE through Drizzle', async () => {
    const { db } = database;
    await db.insert(accounts).values(accountValues('a1', 1500));

    const inserted = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, 'a1'))
      .get();
    expect(inserted).toEqual(accountValues('a1', 1500));

    await db
      .update(accounts)
      .set({ name: 'Renombrada' })
      .where(eq(accounts.id, 'a1'));
    const updated = await db.select().from(accounts).get();
    expect(updated?.name).toBe('Renombrada');
  });

  it('returns undefined from get() when there is no row', async () => {
    const row = await database.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, 'missing'))
      .get();
    expect(row).toBeUndefined();
  });

  it('commits a transaction', async () => {
    await database.withTransaction(async tx => {
      await tx.insert(accounts).values(accountValues('a1'));
      await tx.insert(accounts).values(accountValues('a2'));
    });
    expect(await countAccounts(database)).toBe(2);
  });

  it('rolls back every statement when the work throws', async () => {
    await expect(
      database.withTransaction(async tx => {
        await tx.insert(accounts).values(accountValues('a1'));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await countAccounts(database)).toBe(0);
  });

  it('rolls back when a statement fails inside the transaction', async () => {
    await expect(
      database.withTransaction(async tx => {
        await tx.insert(accounts).values(accountValues('a1'));
        await tx.insert(accounts).values(accountValues('a1')); // duplicate PK
      }),
    ).rejects.toThrow();
    expect(await countAccounts(database)).toBe(0);
  });

  it('keeps queries outside a transaction from interleaving with it', async () => {
    let releaseWork!: () => void;
    const workBlocked = new Promise<void>(resolve => {
      releaseWork = resolve;
    });

    const transaction = database
      .withTransaction(async tx => {
        await tx.insert(accounts).values(accountValues('a1'));
        await workBlocked;
        throw new Error('rollback');
      })
      .catch(() => undefined);
    // Issued while the transaction is open: must wait and must not be rolled back with it.
    const outside = database.db.insert(accounts).values(accountValues('a2'));
    releaseWork();
    await Promise.all([transaction, outside]);

    const ids = await database.db.select({ id: accounts.id }).from(accounts);
    expect(ids).toEqual([{ id: 'a2' }]);
  });
});

describe('initialization and migrations', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(() => database.close());

  it('applies the initial migration', async () => {
    const tables = await database.db.values<[string]>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    expect(tables.map(([name]) => name)).toEqual([
      'accounts',
      'cards',
      'schema_migrations',
      'transactions',
    ]);

    const applied = await database.db.values<[number, string]>(
      sql`SELECT idx, tag FROM schema_migrations`,
    );
    expect(applied).toEqual([[0, '0000_initial_schema']]);
  });

  it('creates the expected indexes, partial where intended', async () => {
    const indexes = await database.db.values<[string, string]>(
      sql`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name`,
    );
    const byName = Object.fromEntries(indexes);
    expect(Object.keys(byName)).toEqual([
      'cards_account_id_idx',
      'cards_id_account_id_unique',
      'transactions_account_id_local_date_idx',
      'transactions_card_id_idx',
      'transactions_category_id_local_date_idx',
      'transactions_local_date_idx',
      'transactions_to_account_id_idx',
    ]);
    for (const name of Object.keys(byName).filter(n =>
      n.startsWith('transactions_'),
    )) {
      expect(byName[name]).toMatch(/WHERE .*deleted_at" IS NULL/);
    }
  });

  it('is idempotent: running migrations again changes nothing', async () => {
    await prepareDatabase(database);
    await migrate(database, migrations);
    const [[count]] = await database.db.values<[number]>(
      sql`SELECT count(*) FROM schema_migrations`,
    );
    expect(count).toBe(1);
  });

  it('has foreign keys enabled', async () => {
    const [[enabled]] = await database.db.values<[number]>(
      sql`PRAGMA foreign_keys`,
    );
    expect(enabled).toBe(1);
  });

  it('rolls back a failing migration and does not record it', async () => {
    const bundle: MigrationBundle = {
      journal: {
        entries: [
          ...migrations.journal.entries,
          { idx: 1, tag: 'broken' },
        ],
      },
      migrations: {
        ...migrations.migrations,
        m0001:
          'CREATE TABLE extra (id TEXT PRIMARY KEY);--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);',
      },
    };
    await expect(migrate(database, bundle)).rejects.toThrow();

    const tables = await database.db.values<[string]>(
      sql`SELECT name FROM sqlite_master WHERE name = 'extra'`,
    );
    expect(tables).toEqual([]);
    const [[count]] = await database.db.values<[number]>(
      sql`SELECT count(*) FROM schema_migrations`,
    );
    expect(count).toBe(1);
  });

  describe('table rebuilds (drizzle-kit PRAGMA foreign_keys=OFF/ON)', () => {
    /** Same statement shape drizzle-kit emits when it recreates a table. */
    function rebuildAccounts(copyRows: string): MigrationBundle {
      const statements = [
        'PRAGMA foreign_keys=OFF;',
        'CREATE TABLE `__new_accounts` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `type` text NOT NULL, `currency` text NOT NULL, `initial_balance_minor` integer NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL, `deleted_at` text);',
        copyRows,
        'DROP TABLE `accounts`;',
        'ALTER TABLE `__new_accounts` RENAME TO `accounts`;',
        'PRAGMA foreign_keys=ON;',
      ];
      return {
        journal: {
          entries: [
            ...migrations.journal.entries,
            { idx: 1, tag: 'rebuild_accounts' },
          ],
        },
        migrations: {
          ...migrations.migrations,
          m0001: statements.join('--> statement-breakpoint\n'),
        },
      };
    }

    beforeEach(async () => {
      // A child row: dropping `accounts` with foreign keys on would fail.
      await database.db.insert(accounts).values(accountValues('a1'));
      await database.db.run(
        sql`INSERT INTO cards VALUES ('c1', 'a1', 'Visa', '1234', 'visa', ${NOW}, ${NOW}, NULL)`,
      );
    });

    it('disables foreign keys before BEGIN and re-enables them after COMMIT', async () => {
      await migrate(
        database,
        rebuildAccounts('INSERT INTO `__new_accounts` SELECT * FROM `accounts`;'),
      );

      expect(await countAccounts(database)).toBe(1);
      const [[enabled]] = await database.db.values<[number]>(
        sql`PRAGMA foreign_keys`,
      );
      expect(enabled).toBe(1);
    });

    it('rolls back when foreign_key_check finds violations', async () => {
      // Drops the rows, leaving card c1 pointing to a missing account.
      await expect(
        migrate(database, rebuildAccounts('SELECT 1;')),
      ).rejects.toThrow(/foreign key violation/);

      expect(await countAccounts(database)).toBe(1);
      const [[enabled]] = await database.db.values<[number]>(
        sql`PRAGMA foreign_keys`,
      );
      expect(enabled).toBe(1);
    });
  });
});

describe('generateId', () => {
  it('returns distinct UUID v4 values', async () => {
    const database = await createTestDatabase();
    const ids = await Promise.all(
      Array.from({ length: 50 }, () => generateId(database.db)),
    );
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
    expect(new Set(ids).size).toBe(ids.length);
    await database.close();
  });
});
