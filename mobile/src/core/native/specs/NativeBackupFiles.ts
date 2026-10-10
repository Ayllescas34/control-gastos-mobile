import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Codegen spec of the Android module BackupFilesModule (Storage Access Framework). Only
 * Android implements it; use core/native/backupFiles.ts, never this module directly.
 *
 * Rejection codes: E_CANCELLED (the user closed the picker), E_BUSY (another picker is
 * open), E_NO_ACTIVITY (the app is not in the foreground), E_UNAVAILABLE (no app handles
 * the picker), E_WRITE_FAILED, E_READ_FAILED, E_TOO_LARGE (over maxBytes), E_NOT_TEXT
 * (not UTF-8).
 */
export interface Spec extends TurboModule {
  /** Lets the user pick where to create `suggestedName`, then writes `content` as UTF-8. */
  createDocument(suggestedName: string, content: string): Promise<void>;
  /** Lets the user pick a document and resolves its UTF-8 text, up to `maxBytes`. */
  openDocument(maxBytes: number): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('BackupFiles');
