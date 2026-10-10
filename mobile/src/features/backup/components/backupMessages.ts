import { FileTransferError } from '../../../core/native/backupFiles';
import {
  BackupTooLargeError,
  InvalidBackupError,
  type BackupProblem,
} from '../domain/backupErrors';
import { MAX_BACKUP_BYTES } from '../domain/backupFormat';
import type { BackupTable } from '../domain/types';

/** Collection names as the user knows them. */
export const BACKUP_TABLE_LABELS: Record<BackupTable, string> = {
  accounts: 'Cuentas',
  categories: 'Categorías',
  cards: 'Tarjetas',
  transactions: 'Movimientos',
  budgets: 'Presupuestos',
  savingsGoals: 'Metas de ahorro',
};

const MAX_MEGABYTES = Math.round(MAX_BACKUP_BYTES / (1024 * 1024));

/** Where in the file, e.g. " (Movimientos, registro 3)". */
function location(problem: BackupProblem): string {
  if (!problem.table) {
    return '';
  }
  const table = BACKUP_TABLE_LABELS[problem.table];
  return problem.index === undefined
    ? ` (${table})`
    : ` (${table}, registro ${problem.index + 1})`;
}

/** One problem in words. Values from the file are never shown. */
export function describeBackupProblem(problem: BackupProblem): string {
  switch (problem.code) {
    case 'empty':
      return 'El archivo está vacío.';
    case 'too_large':
      return `El archivo supera el máximo de ${MAX_MEGABYTES} MB.`;
    case 'too_deep':
    case 'not_json':
      return 'El archivo no es un JSON válido.';
    case 'unknown_format':
      return 'El archivo no es un respaldo de Control de Gastos.';
    case 'unsupported_version':
      return 'Esta versión de la app no reconoce el formato de este respaldo.';
    case 'schema_mismatch':
      return 'El respaldo se creó con otra versión de la base de datos de la app y no se puede restaurar en esta versión.';
    case 'invalid_structure':
      return `El respaldo está incompleto o dañado${location(problem)}.`;
    case 'invalid_field':
      return `El respaldo tiene un dato faltante o no válido${location(
        problem,
      )}${problem.field ? `, campo "${problem.field}"` : ''}.`;
    case 'duplicate_id':
      return `El respaldo tiene registros repetidos${location(problem)}.`;
    case 'broken_reference':
      return `El respaldo tiene un registro que apunta a otro que no existe${location(
        problem,
      )}.`;
    case 'duplicate_active':
      return `El respaldo tiene registros activos duplicados${location(
        problem,
      )}.`;
    case 'rule_violation':
      return `El respaldo tiene datos que no cumplen las reglas de la app${location(
        problem,
      )}.`;
  }
}

const UNCHANGED = 'Tus datos actuales no cambiaron.';

/** Why a backup could not be read or restored. Always says the data is untouched. */
export function describeRestoreError(error: unknown): string {
  if (error instanceof InvalidBackupError) {
    const [first] = error.problems;
    const more = error.problems.length - 1;
    const extra =
      more > 0
        ? ` Hay ${more} ${more === 1 ? 'problema más' : 'problemas más'}.`
        : '';
    return `${
      first ? describeBackupProblem(first) : 'El respaldo no es válido.'
    }${extra} ${UNCHANGED}`;
  }
  if (error instanceof FileTransferError) {
    return `${describeFileError(error)} ${UNCHANGED}`;
  }
  return `No se pudo restaurar el respaldo. ${UNCHANGED}`;
}

/** Why a backup could not be exported. */
export function describeExportError(error: unknown): string {
  if (error instanceof BackupTooLargeError) {
    return `Tus datos superan el máximo de ${MAX_MEGABYTES} MB de un respaldo y no se pueden exportar.`;
  }
  if (error instanceof FileTransferError) {
    return describeFileError(error);
  }
  return 'No se pudo crear el respaldo. Inténtalo de nuevo.';
}

function describeFileError(error: FileTransferError): string {
  switch (error.code) {
    case 'unavailable':
      return 'El selector de archivos no está disponible en este dispositivo.';
    case 'busy':
      return 'Ya hay un selector de archivos abierto.';
    case 'no_activity':
      return 'La app debe estar abierta en pantalla para elegir un archivo.';
    case 'write_failed':
      return 'No se pudo guardar el archivo. Elige otra ubicación e inténtalo de nuevo.';
    case 'read_failed':
      return 'No se pudo leer el archivo.';
    case 'too_large':
      return `El archivo supera el máximo de ${MAX_MEGABYTES} MB.`;
    case 'not_text':
      return 'El archivo no es un respaldo de Control de Gastos.';
  }
}

/**
 * What may be logged about a failure: its kind and codes only. SQL errors from Drizzle
 * carry the statement parameters, i.e. financial data, so the error itself is never logged.
 */
export function backupErrorLogSummary(error: unknown): string {
  if (error instanceof InvalidBackupError) {
    return `InvalidBackupError: ${error.problems.map(p => p.code).join(', ')}`;
  }
  if (error instanceof FileTransferError) {
    return `FileTransferError: ${error.code}`;
  }
  return error instanceof Error ? error.name : typeof error;
}
