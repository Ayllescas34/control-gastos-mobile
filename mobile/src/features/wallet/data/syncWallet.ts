import type { Database } from '../../../core/db';
import {
  acknowledgeWalletNotifications,
  isWalletAccessGranted,
  isWalletCaptureSupported,
  readPendingWalletNotifications,
} from '../../../core/native/walletCaptures';
import {
  importWalletNotifications,
  registerWaitingCaptures,
  type WalletImportResult,
} from './walletCaptureRepository';

/**
 * Moves the payments queued by the Android listener into SQLite, then acknowledges them.
 * Safe to call on every focus: duplicates are ignored. No-op outside Android.
 */
export async function syncWalletNotifications(
  database: Database,
): Promise<WalletImportResult | null> {
  if (!isWalletCaptureSupported()) {
    return null;
  }
  const pending = await readPendingWalletNotifications();
  const result = await importWalletNotifications(database, pending);
  await acknowledgeWalletNotifications(result.processedIds);
  // Waiting captures whose account was configured since they arrived.
  result.registered += await registerWaitingCaptures(database);
  return result;
}

export type WalletConnection =
  /** Not Android: notifications cannot be read. */
  | 'unsupported'
  /** Android, but the user has not granted notification access yet. */
  | 'disconnected'
  | 'connected';

export async function readWalletConnection(): Promise<WalletConnection> {
  if (!isWalletCaptureSupported()) {
    return 'unsupported';
  }
  try {
    return (await isWalletAccessGranted()) ? 'connected' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

/** Syncs, but never lets a sync failure break the screen that asked for it. */
export async function syncWalletQuietly(database: Database): Promise<void> {
  try {
    await syncWalletNotifications(database);
  } catch (error) {
    console.error('Wallet sync failed', error);
  }
}
