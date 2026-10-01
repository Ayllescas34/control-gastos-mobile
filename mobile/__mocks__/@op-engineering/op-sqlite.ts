/**
 * Jest stand-in for the native op-sqlite module (JSI is not available under Jest).
 * Jest applies it automatically to every test. It is backed by a real in-memory SQLite
 * (node:sqlite) and mirrors op-sqlite 18's `executeRaw` result shape, so code importing
 * the app client (e.g. App.test.tsx) still runs real SQL.
 */
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';

export function open(_options: { name: string; location?: string }) {
  const executor = createNodeSqliteExecutor();
  return {
    async executeRaw(sql: string, params: unknown[] = []) {
      const rawRows = await executor.execute(sql, params);
      return { rawRows, columnNames: [], rowsAffected: 0 };
    },
    close() {
      executor.close().catch(() => undefined);
    },
  };
}
