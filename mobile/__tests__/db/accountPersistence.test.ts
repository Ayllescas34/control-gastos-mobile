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
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import {
  createAccountRepository,
  createCardRepository,
} from '../../src/features/accounts';

/** Opens (and migrates) the SQLite file the way the app opens its database file. */
function openFile(path: string): Promise<Database> {
  return prepareDatabase(
    createDatabase(createNodeSqliteExecutor(new DatabaseSync(path))),
  );
}

describe('accounts and cards persist across connections', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'control-gastos-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads back, from a new connection, what an earlier one wrote', async () => {
    const path = join(directory, 'control-gastos.db');

    const first = await openFile(path);
    const account = await createAccountRepository(first.db).create({
      name: 'Cuenta A',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: -150050,
    });
    const card = await createCardRepository(first.db).create({
      accountId: account.id,
      alias: 'Visa A',
      last4: '0042',
      network: 'visa',
    });
    // Like closing the app: nothing survives except the file.
    await first.close();

    const second = await openFile(path);
    try {
      expect(await createAccountRepository(second.db).list()).toEqual([
        account,
      ]);
      expect(await createCardRepository(second.db).list()).toEqual([card]);
    } finally {
      await second.close();
    }
  });

  it('keeps archived rows in the file but out of normal reads', async () => {
    const path = join(directory, 'control-gastos.db');

    const first = await openFile(path);
    const accounts = createAccountRepository(first.db);
    const kept = await accounts.create({
      name: 'Se queda',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const archived = await accounts.create({
      name: 'Archivada',
      type: 'cash',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    await accounts.softDelete(archived.id);
    await first.close();

    const second = await openFile(path);
    try {
      const reopened = createAccountRepository(second.db);
      expect((await reopened.list()).map(a => a.id)).toEqual([kept.id]);
      expect(await reopened.getById(archived.id)).toBeNull();
      // A raw count proves the soft-deleted row was not physically removed.
      const [[stored]] = await second.db.values<[number]>(
        sql`SELECT count(*) FROM accounts`,
      );
      expect(stored).toBe(2);
    } finally {
      await second.close();
    }
  });
});
