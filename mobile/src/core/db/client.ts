import { open } from '@op-engineering/op-sqlite';
import {
  drizzle,
  type AsyncRemoteCallback,
  type SqliteRemoteDatabase,
} from 'drizzle-orm/sqlite-proxy';
import { createOpSqliteExecutor, type SqlExecutor } from './executor';
import * as schema from './schema';
import { createSerialQueue, runInTransaction } from './transaction';

/** File name inside the platform's app database directory (persistent, private to the app). */
const DATABASE_NAME = 'control-gastos.db';

export type AppDatabase = SqliteRemoteDatabase<typeof schema>;

export type Database = {
  db: AppDatabase;
  /**
   * Atomic unit of work. Use only `tx` inside `work`; queries through `db` (or a nested
   * withTransaction) wait for the transaction to finish, so awaiting them inside would deadlock.
   * Do not use Drizzle's own `db.transaction()`: it bypasses this queue.
   */
  withTransaction<T>(work: (tx: AppDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

function toRemoteCallback(
  execute: SqlExecutor['execute'],
): AsyncRemoteCallback {
  return async (sql, params, method) => {
    const rows = await execute(sql, params);
    return { rows: method === 'get' ? rows[0] : rows };
  };
}

/**
 * Drizzle (sqlite-proxy) over one connection. Every statement goes through a serial queue so a
 * running transaction never interleaves with unrelated queries on the same connection.
 */
export function createDatabase(executor: SqlExecutor): Database {
  const queue = createSerialQueue();

  const db = drizzle(
    toRemoteCallback((sql, params) =>
      queue.run(() => executor.execute(sql, params)),
    ),
    { schema },
  );

  // Inside a transaction the queue is already held: statements go straight to the connection.
  const tx = drizzle(
    toRemoteCallback((sql, params) => executor.execute(sql, params)),
    { schema },
  );

  return {
    db,
    withTransaction: work =>
      queue.run(() => runInTransaction(executor, () => work(tx))),
    close: () => queue.run(() => executor.close()),
  };
}

/** Opens the app's SQLite file through op-sqlite. Call via initDatabase(), not directly. */
export function openAppDatabase(): Database {
  return createDatabase(createOpSqliteExecutor(open({ name: DATABASE_NAME })));
}
