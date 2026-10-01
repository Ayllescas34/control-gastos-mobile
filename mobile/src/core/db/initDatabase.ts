import { sql } from 'drizzle-orm';
import { openAppDatabase, type Database } from './client';
import { migrate, type MigrationBundle } from './migrate';
import migrations from './migrations/migrations';

/**
 * Connection settings, then pending migrations. Shared by the app and by tests so both run
 * the same schema. Foreign keys are off by default in SQLite, so they are enabled and verified.
 */
export async function prepareDatabase(
  database: Database,
  bundle: MigrationBundle = migrations,
): Promise<Database> {
  const { db } = database;

  await db.run(sql`PRAGMA foreign_keys = ON`);
  const [foreignKeys] = await db.values<[number]>(sql`PRAGMA foreign_keys`);
  if (foreignKeys?.[0] !== 1) {
    throw new Error('SQLite foreign keys could not be enabled');
  }
  // WAL: crash-safe commits without blocking reads. In-memory databases report "memory".
  await db.run(sql`PRAGMA journal_mode = WAL`);

  await migrate(database, bundle);
  return database;
}

let ready: Promise<Database> | null = null;

/**
 * Opens the app database once and prepares it. Idempotent: every caller shares the same
 * connection. After a failure the next call retries instead of caching the error.
 */
export function initDatabase(): Promise<Database> {
  if (!ready) {
    ready = (async () => {
      const database = openAppDatabase();
      try {
        return await prepareDatabase(database);
      } catch (error) {
        await database.close().catch(() => undefined);
        throw error;
      }
    })();
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}
