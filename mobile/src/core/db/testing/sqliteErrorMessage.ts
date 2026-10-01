/**
 * Awaits a rejected query and returns the SQLite message. Drizzle wraps driver errors in
 * DrizzleQueryError ("Failed query: ...") and keeps the original one in `cause`.
 * Read by property: node:sqlite errors come from another realm, so `instanceof Error` fails.
 */
export async function sqliteErrorMessage(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    const cause = (error as { cause?: { message?: unknown } }).cause;
    return typeof cause?.message === 'string' ? cause.message : String(error);
  }
  throw new Error('Expected the query to fail');
}
