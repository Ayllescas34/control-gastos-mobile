import { asc, getTableColumns, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import {
  accounts,
  budgets,
  cards,
  categories,
  savingsGoals,
  transactions,
  type AppDatabase,
  type Database,
} from '../../../core/db';
import { nowIsoDateTime } from '../../../shared/lib/dates';
// Mappers by module (not the feature indexes) to keep features free of import cycles.
import {
  accountToInsert,
  rowToAccount,
} from '../../accounts/data/accountMappers';
import { cardToInsert, rowToCard } from '../../accounts/data/cardMappers';
import { budgetToInsert, rowToBudget } from '../../budgets/data/budgetMappers';
import {
  categoryToInsert,
  rowToCategory,
} from '../../categories/data/categoryMappers';
import {
  rowToSavingsGoal,
  savingsGoalToInsert,
} from '../../savings/data/savingsGoalMappers';
import {
  rowToTransaction,
  transactionToInsert,
} from '../../transactions/data/transactionMappers';
import { InvalidBackupError } from '../domain/backupErrors';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupFile,
  type ValidatedBackup,
} from '../domain/types';

/** Bound parameters per INSERT, under SQLite's historical limit of 999. */
const MAX_PARAMS_PER_STATEMENT = 900;

/** Rows per multi-row INSERT for `table`, so no statement exceeds the parameter limit. */
function rowsPerInsert(table: SQLiteTable): number {
  return Math.floor(
    MAX_PARAMS_PER_STATEMENT / Object.keys(getTableColumns(table)).length,
  );
}

function chunk<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < rows.length; start += size) {
    chunks.push(rows.slice(start, start + size));
  }
  return chunks;
}

/** Index of the last applied migration (schema_migrations, written by core/db/migrate). */
async function readSchemaVersion(db: AppDatabase): Promise<number> {
  const [version] = await db.get<[number | null]>(
    sql`SELECT max(idx) FROM schema_migrations`,
  );
  return version ?? -1;
}

/**
 * Whole-database backup and restore (docs/backup.md). Reads and writes the six tables
 * with the existing mappers, so rows travel exactly as stored: no recalculation, no
 * normalization, archived rows included.
 */
export function createBackupRepository(database: Database) {
  return {
    /** Schema version a backup must have to be restored into this database. */
    currentSchemaVersion(): Promise<number> {
      return readSchemaVersion(database.db);
    },

    /**
     * Every row of the six tables. The reads share one transaction, so the backup is a
     * consistent snapshot even if a write is queued meanwhile. Writes nothing.
     */
    exportBackup(): Promise<BackupFile> {
      return database.withTransaction(async tx => {
        // One statement at a time: inside a transaction the connection is not queued.
        const schemaVersion = await readSchemaVersion(tx);
        const accountRows = await tx
          .select()
          .from(accounts)
          .orderBy(asc(accounts.createdAt), asc(accounts.id));
        const categoryRows = await tx
          .select()
          .from(categories)
          .orderBy(asc(categories.createdAt), asc(categories.id));
        const cardRows = await tx
          .select()
          .from(cards)
          .orderBy(asc(cards.createdAt), asc(cards.id));
        const transactionRows = await tx
          .select()
          .from(transactions)
          .orderBy(asc(transactions.createdAt), asc(transactions.id));
        const budgetRows = await tx
          .select()
          .from(budgets)
          .orderBy(asc(budgets.createdAt), asc(budgets.id));
        const goalRows = await tx
          .select()
          .from(savingsGoals)
          .orderBy(asc(savingsGoals.createdAt), asc(savingsGoals.id));

        return {
          format: BACKUP_FORMAT,
          formatVersion: BACKUP_FORMAT_VERSION,
          schemaVersion,
          exportedAt: nowIsoDateTime(),
          data: {
            accounts: accountRows.map(rowToAccount),
            categories: categoryRows.map(rowToCategory),
            cards: cardRows.map(rowToCard),
            transactions: transactionRows.map(rowToTransaction),
            budgets: budgetRows.map(rowToBudget),
            savingsGoals: goalRows.map(rowToSavingsGoal),
          },
        };
      });
    },

    /**
     * Replaces every row of the six tables with the backup's, in ONE transaction: deletes
     * children before parents, inserts parents before children, with foreign keys and
     * CHECKs active the whole time, then runs PRAGMA foreign_key_check. Any failure rolls
     * back, so the current data stays exactly as it was. This is the only physical delete
     * in the app, and it only runs on a backup already validated by parseBackup().
     */
    async restoreBackup(backup: ValidatedBackup): Promise<void> {
      const { data } = backup;
      await database.withTransaction(async tx => {
        if ((await readSchemaVersion(tx)) !== backup.schemaVersion) {
          throw new InvalidBackupError([{ code: 'schema_mismatch' }]);
        }

        await tx.delete(savingsGoals);
        await tx.delete(budgets);
        await tx.delete(transactions);
        await tx.delete(cards);
        await tx.delete(categories);
        await tx.delete(accounts);

        for (const rows of chunk(
          data.accounts.map(accountToInsert),
          rowsPerInsert(accounts),
        )) {
          await tx.insert(accounts).values(rows);
        }
        for (const rows of chunk(
          data.categories.map(categoryToInsert),
          rowsPerInsert(categories),
        )) {
          await tx.insert(categories).values(rows);
        }
        for (const rows of chunk(
          data.cards.map(cardToInsert),
          rowsPerInsert(cards),
        )) {
          await tx.insert(cards).values(rows);
        }
        for (const rows of chunk(
          data.transactions.map(transactionToInsert),
          rowsPerInsert(transactions),
        )) {
          await tx.insert(transactions).values(rows);
        }
        for (const rows of chunk(
          data.budgets.map(budgetToInsert),
          rowsPerInsert(budgets),
        )) {
          await tx.insert(budgets).values(rows);
        }
        for (const rows of chunk(
          data.savingsGoals.map(savingsGoalToInsert),
          rowsPerInsert(savingsGoals),
        )) {
          await tx.insert(savingsGoals).values(rows);
        }

        const violations = await tx.values(sql`PRAGMA foreign_key_check`);
        if (violations.length > 0) {
          throw new Error(
            `Restore leaves ${violations.length} foreign key violation(s)`,
          );
        }
      });
    },
  };
}

export type BackupRepository = ReturnType<typeof createBackupRepository>;
