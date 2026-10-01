import { sql, type SQL } from 'drizzle-orm';
import { text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Shared column definitions and CHECK fragments.
 * This folder is loaded by drizzle-kit from Node: import only drizzle-orm here, never React Native.
 */

/** Largest integer a JS number holds exactly (2^53 - 1). Money columns never exceed it. */
export const MAX_SAFE_MINOR_UNITS = 9007199254740991;

/** UTC instant as produced by Date#toISOString(): YYYY-MM-DDTHH:mm:ss.sssZ. */
const ISO_DATE_TIME_GLOB =
  '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z';

/** Civil date: YYYY-MM-DD. */
const LOCAL_DATE_GLOB = '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';

/** ISO 4217 code: three uppercase letters. */
const CURRENCY_GLOB = '[A-Z][A-Z][A-Z]';

/** Audit columns of every persisted entity. `deleted_at` marks a soft delete. */
export const timestampColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export function isIsoDateTime(column: AnySQLiteColumn): SQL {
  return sql`${column} GLOB ${sql.raw(`'${ISO_DATE_TIME_GLOB}'`)}`;
}

export function isLocalDate(column: AnySQLiteColumn): SQL {
  return sql`${column} GLOB ${sql.raw(`'${LOCAL_DATE_GLOB}'`)}`;
}

export function isCurrencyCode(column: AnySQLiteColumn): SQL {
  return sql`${column} GLOB ${sql.raw(`'${CURRENCY_GLOB}'`)}`;
}

/** Stored as INTEGER (not REAL) and within the exact range of a JS number. */
export function isSafeInteger(column: AnySQLiteColumn): SQL {
  return sql`typeof(${column}) = 'integer' AND abs(${column}) <= ${sql.raw(
    String(MAX_SAFE_MINOR_UNITS),
  )}`;
}

export function isOneOf(column: AnySQLiteColumn, values: readonly string[]): SQL {
  return sql`${column} IN (${sql.raw(values.map(value => `'${value}'`).join(', '))})`;
}

/** CHECK fragments for the audit columns of `timestampColumns`. */
export function timestampChecks(table: {
  createdAt: AnySQLiteColumn;
  updatedAt: AnySQLiteColumn;
  deletedAt: AnySQLiteColumn;
}): SQL {
  return sql`${isIsoDateTime(table.createdAt)} AND ${isIsoDateTime(
    table.updatedAt,
  )} AND (${table.deletedAt} IS NULL OR ${isIsoDateTime(table.deletedAt)})`;
}
