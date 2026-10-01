import { createDatabase, type Database } from '../client';
import { prepareDatabase } from '../initDatabase';
import { createNodeSqliteExecutor } from './nodeSqliteExecutor';

/**
 * Fresh in-memory SQLite with the same PRAGMAs and migrations as the app, through the same
 * Drizzle sqlite-proxy path. Repositories are tested against it: no SQL mocking.
 */
export async function createTestDatabase(): Promise<Database> {
  return prepareDatabase(createDatabase(createNodeSqliteExecutor()));
}
