import { useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import {
  openTextDocument,
  saveTextDocument,
} from '../../../core/native/backupFiles';
import { todayLocalDate } from '../../../shared/lib/dates';
import { createBackupRepository } from '../data/backupRepository';
import { BackupTooLargeError } from '../domain/backupErrors';
import {
  MAX_BACKUP_BYTES,
  backupFileName,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  utf8ByteLength,
} from '../domain/backupFormat';
import type { BackupSummary, ValidatedBackup } from '../domain/types';

export type ReadBackupResult =
  | { status: 'cancelled' }
  | { status: 'ready'; backup: ValidatedBackup; summary: BackupSummary };

/**
 * The backup screen's actions. The screen never touches SQL or the native module: export,
 * read-and-validate and restore are separate steps, so nothing is written until the user
 * confirms what was read.
 */
export function useBackupActions() {
  const database = useDatabase();
  return useMemo(() => {
    const repository = createBackupRepository(database);
    return {
      /** Snapshot → JSON → the place the user picks. */
      async exportToFile(now: Date = new Date()): Promise<'saved' | 'cancelled'> {
        const content = serializeBackup(await repository.exportBackup());
        if (utf8ByteLength(content) > MAX_BACKUP_BYTES) {
          throw new BackupTooLargeError();
        }
        return saveTextDocument(backupFileName(todayLocalDate(now)), content);
      },

      /** Picks a file and validates it completely. Writes nothing. */
      async readFromFile(): Promise<ReadBackupResult> {
        const file = await openTextDocument(MAX_BACKUP_BYTES);
        if (file.status === 'cancelled') {
          return file;
        }
        const backup = parseBackup(
          file.content,
          await repository.currentSchemaVersion(),
        );
        return { status: 'ready', backup, summary: summarizeBackup(backup) };
      },

      /** Replaces all data atomically (rolls back on any failure). */
      restore(backup: ValidatedBackup): Promise<void> {
        return repository.restoreBackup(backup);
      },
    };
  }, [database]);
}
