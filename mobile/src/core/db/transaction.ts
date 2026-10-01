import type { SqlExecutor } from './executor';

/** Runs tasks one after another, in call order. */
export type SerialQueue = {
  run<T>(task: () => Promise<T>): Promise<T>;
};

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    run(task) {
      const result = tail.then(task);
      // Keep the chain alive after a failure; the caller still receives the rejection.
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

/**
 * BEGIN → work → COMMIT, or ROLLBACK when work (or COMMIT) throws.
 * Each step is awaited, unlike drizzle-orm/op-sqlite's transaction().
 * The caller must hold the connection exclusively (see createDatabase).
 */
export async function runInTransaction<T>(
  executor: SqlExecutor,
  work: () => Promise<T>,
): Promise<T> {
  await executor.execute('BEGIN', []);
  try {
    const result = await work();
    await executor.execute('COMMIT', []);
    return result;
  } catch (error) {
    try {
      await executor.execute('ROLLBACK', []);
    } catch {
      // SQLite may have already rolled back (e.g. failed COMMIT); the original error matters.
    }
    throw error;
  }
}
