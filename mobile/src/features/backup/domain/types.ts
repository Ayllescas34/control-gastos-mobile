import type { IsoDateTime } from '../../../shared/domain';
// Entity types by module (not the feature indexes) to keep features free of import cycles.
import type { Account, Card } from '../../accounts/domain/types';
import type { Budget } from '../../budgets/domain/types';
import type { Category } from '../../categories/domain/types';
import type { SavingsGoal } from '../../savings/domain/types';
import type { Transaction } from '../../transactions/domain/types';

/** Identifies a Control de Gastos backup file (docs/backup.md). */
export const BACKUP_FORMAT = 'control-gastos-backup';

/** Version of the file layout. A reader rejects any other value. */
export const BACKUP_FORMAT_VERSION = 1;

/** The six collections, in insertion order (parents before the rows that reference them). */
export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'cards',
  'transactions',
  'budgets',
  'savingsGoals',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Every row of the six tables, archived ones included, exactly as stored. The entities are
 * the domain's, which map one to one to the table columns.
 */
export type BackupData = {
  accounts: Account[];
  categories: Category[];
  cards: Card[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  /** Index of the last applied migration when exported; restore requires the same. */
  schemaVersion: number;
  /** UTC instant of the export. */
  exportedAt: IsoDateTime;
  data: BackupData;
};

declare const validated: unique symbol;

/** A backup that passed parseBackup(): the only kind restoreBackup() accepts. */
export type ValidatedBackup = BackupFile & { readonly [validated]: true };

/** What a restore will write, shown before the user confirms. */
export type BackupSummary = {
  exportedAt: IsoDateTime;
  tables: Record<BackupTable, { total: number; archived: number }>;
};
