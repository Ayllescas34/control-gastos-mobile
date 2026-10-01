import { isNull } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/** Default filter for normal reads: rows with `deleted_at` set are soft-deleted. */
export function notDeleted(table: { deletedAt: AnySQLiteColumn }) {
  return isNull(table.deletedAt);
}
