import type { BackupTable } from './types';

export type BackupProblemCode =
  /** Nothing to read. */
  | 'empty'
  /** Over MAX_BACKUP_BYTES. */
  | 'too_large'
  /** Nested deeper than the format allows (checked before parsing). */
  | 'too_deep'
  | 'not_json'
  /** Not a Control de Gastos backup. */
  | 'unknown_format'
  | 'unsupported_version'
  /** Exported with another database schema than this app's. */
  | 'schema_mismatch'
  /** Missing, extra or mistyped keys outside the rows. */
  | 'invalid_structure'
  /** A row field is missing, extra or has a wrong type or value. */
  | 'invalid_field'
  | 'duplicate_id'
  /** A row references a row that is not in the backup. */
  | 'broken_reference'
  /** Two active rows break a one-active rule (a partial unique index of the schema). */
  | 'duplicate_active'
  /** A domain rule is broken. */
  | 'rule_violation';

export type BackupProblem = {
  code: BackupProblemCode;
  table?: BackupTable;
  /** Zero-based position of the row in its collection. */
  index?: number;
  field?: string;
  /** The broken domain rule, e.g. "currency_mismatch". */
  rule?: string;
};

/** Thrown by parseBackup() when the file cannot be restored. Nothing has been written. */
export class InvalidBackupError extends Error {
  readonly problems: BackupProblem[];

  constructor(problems: BackupProblem[]) {
    super(`Invalid backup: ${problems.map(p => p.code).join(', ')}`);
    this.name = 'InvalidBackupError';
    this.problems = problems;
  }
}

/** The export would be larger than a restore accepts (MAX_BACKUP_BYTES). */
export class BackupTooLargeError extends Error {
  constructor() {
    super('The backup exceeds the maximum size');
    this.name = 'BackupTooLargeError';
  }
}
