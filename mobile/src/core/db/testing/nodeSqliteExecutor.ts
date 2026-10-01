/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import type { SqlExecutor, SqlRow } from '../executor';

/**
 * SqlExecutor over Node's built-in SQLite (Node >= 22.16, for setReturnArrays). Tests only: never bundled in the app.
 * Real SQL engine, so constraints, foreign keys and transactions behave as on the device.
 */
export function createNodeSqliteExecutor(
  connection: DatabaseSync = new DatabaseSync(':memory:'),
): SqlExecutor {
  return {
    async execute(sql, params) {
      const statement = connection.prepare(sql);
      const bound = params as never[];
      if (statement.columns().length === 0) {
        statement.run(...bound);
        return [];
      }
      statement.setReturnArrays(true);
      return statement.all(...bound) as unknown as SqlRow[];
    },
    async close() {
      connection.close();
    },
  };
}
