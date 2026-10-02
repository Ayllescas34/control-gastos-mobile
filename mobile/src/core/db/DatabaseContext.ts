import { createContext, useContext } from 'react';
import type { Database } from './client';

/**
 * The ready database, provided once at the app root (app/providers/DatabaseProvider)
 * and by tests with a test database. Lives in core so features do not depend on app/.
 */
export const DatabaseContext = createContext<Database | null>(null);

/** The ready database. Only usable below a DatabaseContext provider. */
export function useDatabase(): Database {
  const database = useContext(DatabaseContext);
  if (!database) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return database;
}
