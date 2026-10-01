import type { DB } from '@op-engineering/op-sqlite';

/** Values that cross the SQL boundary. INTEGER columns arrive as exact JS integers (|n| <= 2^53 - 1). */
export type SqlValue = string | number | null;

export type SqlRow = SqlValue[];

/**
 * Minimal contract between Drizzle (sqlite-proxy) and a concrete SQLite connection.
 * Implemented by op-sqlite in the app and by node:sqlite in tests.
 */
export type SqlExecutor = {
  /** Runs one statement. Returns its rows as value arrays in column order (empty for writes). */
  execute(sql: string, params: readonly unknown[]): Promise<SqlRow[]>;
  close(): Promise<void>;
};

/**
 * op-sqlite 18 `executeRaw` resolves `{ rawRows, columnNames }`: the shape drizzle-orm/op-sqlite
 * cannot read, which is why the app uses drizzle-orm/sqlite-proxy on top of this executor.
 * op-sqlite binds integers beyond 32 bits as doubles; INTEGER column affinity stores them back
 * as exact integers, and the schema CHECKs reject anything that is not an integer.
 */
export function createOpSqliteExecutor(
  connection: Pick<DB, 'executeRaw' | 'close'>,
): SqlExecutor {
  return {
    async execute(sql, params) {
      const result = await connection.executeRaw(sql, params as never[]);
      return (result.rawRows ?? []) as SqlRow[];
    },
    async close() {
      connection.close();
    },
  };
}
