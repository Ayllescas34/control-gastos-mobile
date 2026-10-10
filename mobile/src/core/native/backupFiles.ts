import { Platform } from 'react-native';
import NativeBackupFiles from './specs/NativeBackupFiles';

export type FileTransferErrorCode =
  /** Not on Android, or no app can show the system file picker. */
  | 'unavailable'
  /** A picker is already open. */
  | 'busy'
  /** The app is not in the foreground. */
  | 'no_activity'
  | 'write_failed'
  | 'read_failed'
  | 'too_large'
  /** The chosen file is not UTF-8 text. */
  | 'not_text';

/** A document could not be saved or opened. Carries no file content. */
export class FileTransferError extends Error {
  readonly code: FileTransferErrorCode;

  constructor(code: FileTransferErrorCode) {
    super(`File transfer failed: ${code}`);
    this.name = 'FileTransferError';
    this.code = code;
  }
}

const NATIVE_CODES: Record<string, FileTransferErrorCode> = {
  E_UNAVAILABLE: 'unavailable',
  E_BUSY: 'busy',
  E_NO_ACTIVITY: 'no_activity',
  E_WRITE_FAILED: 'write_failed',
  E_READ_FAILED: 'read_failed',
  E_TOO_LARGE: 'too_large',
  E_NOT_TEXT: 'not_text',
};

const CANCELLED = 'E_CANCELLED';

function nativeModule() {
  if (Platform.OS !== 'android' || !NativeBackupFiles) {
    throw new FileTransferError('unavailable');
  }
  return NativeBackupFiles;
}

function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/** Maps a native rejection; unknown failures count as `fallback`. */
function toFileTransferError(
  error: unknown,
  fallback: FileTransferErrorCode,
): FileTransferError {
  return new FileTransferError(NATIVE_CODES[codeOf(error) ?? ''] ?? fallback);
}

/**
 * Asks the user where to save `fileName` (system picker, no storage permission) and writes
 * `content`. Android only in V1 (docs/backup.md).
 */
export async function saveTextDocument(
  fileName: string,
  content: string,
): Promise<'saved' | 'cancelled'> {
  const files = nativeModule();
  try {
    await files.createDocument(fileName, content);
    return 'saved';
  } catch (error) {
    if (codeOf(error) === CANCELLED) {
      return 'cancelled';
    }
    throw toFileTransferError(error, 'write_failed');
  }
}

/** Asks the user for a document and reads it as text, refusing more than `maxBytes`. */
export async function openTextDocument(
  maxBytes: number,
): Promise<{ status: 'opened'; content: string } | { status: 'cancelled' }> {
  const files = nativeModule();
  try {
    return { status: 'opened', content: await files.openDocument(maxBytes) };
  } catch (error) {
    if (codeOf(error) === CANCELLED) {
      return { status: 'cancelled' };
    }
    throw toFileTransferError(error, 'read_failed');
  }
}
