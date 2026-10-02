/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { createDatabase, type Database } from '../client';
import { prepareDatabase } from '../initDatabase';
import { createNodeSqliteExecutor } from './nodeSqliteExecutor';

/**
 * Tests only: a migrated in-memory SQLite database (`database`) plus a second handle on the
 * same connection (`gated`) whose queries wait until `release()`, to observe loading states
 * with real SQL.
 */
export async function createGatedTestDatabase(): Promise<{
  database: Database;
  gated: Database;
  release: () => void;
}> {
  const executor = createNodeSqliteExecutor(new DatabaseSync(':memory:'));
  const database = await prepareDatabase(createDatabase(executor));

  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const gated = createDatabase({
    execute: async (sql, params) => {
      await gate;
      return executor.execute(sql, params);
    },
    // The connection belongs to `database`.
    close: async () => {},
  });
  return { database, gated, release };
}
