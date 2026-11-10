import { Platform } from 'react-native';
import NativeWalletCaptures from './specs/NativeWalletCaptures';

/** Google Wallet's Android package: its notifications are payments. */
export const GOOGLE_WALLET_PACKAGE = 'com.google.android.apps.walletnfcrel';

/**
 * A notification queued by the Android listener: a Google Wallet one, or a message from a
 * configured bank sender (title = sender, text = message).
 */
export type RawWalletNotification = {
  /** Stable id computed on the device (package, event time, title and text). */
  id: string;
  packageName: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  /** Event time of the notification, epoch milliseconds. */
  postedAt: number;
};

/** Notification capture only exists on Android (NotificationListenerService). */
export function isWalletCaptureSupported(): boolean {
  return Platform.OS === 'android' && NativeWalletCaptures !== null;
}

export async function isWalletAccessGranted(): Promise<boolean> {
  if (!isWalletCaptureSupported() || !NativeWalletCaptures) {
    return false;
  }
  return NativeWalletCaptures.isAccessGranted();
}

/** Opens system settings so the user can grant notification access. False when it cannot. */
export async function openWalletAccessSettings(): Promise<boolean> {
  if (!NativeWalletCaptures) {
    return false;
  }
  try {
    await NativeWalletCaptures.openAccessSettings();
    return true;
  } catch {
    return false;
  }
}

function isRawNotification(value: unknown): value is RawWalletNotification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  const optionalText = (key: string) =>
    entry[key] === null ||
    entry[key] === undefined ||
    typeof entry[key] === 'string';
  return (
    typeof entry.id === 'string' &&
    typeof entry.packageName === 'string' &&
    typeof entry.postedAt === 'number' &&
    optionalText('title') &&
    optionalText('text') &&
    optionalText('bigText')
  );
}

/** Parses the native queue; malformed entries are dropped. */
export function parseRawNotifications(json: string): RawWalletNotification[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isRawNotification).map(entry => ({
    id: entry.id,
    packageName: entry.packageName,
    title: entry.title ?? null,
    text: entry.text ?? null,
    bigText: entry.bigText ?? null,
    postedAt: entry.postedAt,
  }));
}

/** Queued notifications not yet acknowledged. Empty outside Android. */
export async function readPendingWalletNotifications(): Promise<
  RawWalletNotification[]
> {
  if (!NativeWalletCaptures) {
    return [];
  }
  return parseRawNotifications(await NativeWalletCaptures.readPending());
}

/** Drops these ids from the native queue (call only after they are in SQLite). */
export async function acknowledgeWalletNotifications(
  ids: readonly string[],
): Promise<void> {
  if (!NativeWalletCaptures || ids.length === 0) {
    return;
  }
  await NativeWalletCaptures.acknowledge(ids);
}

/** A bank sender or message prefix: the SMS number ("2424") or its first word ("BiMovil"). */
const SENDER = /^[\p{L}\p{N} .:_-]{2,30}$/u;

/** Trimmed, valid and without repeats (ignoring case). */
export function normalizeBankSenders(senders: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sender of senders) {
    const value = sender.trim();
    const key = value.toLowerCase();
    if (SENDER.test(value) && !seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

/** Bank SMS senders/prefixes whose messages are captured. Empty outside Android. */
export async function getBankSenders(): Promise<string[]> {
  if (!NativeWalletCaptures) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(await NativeWalletCaptures.getBankSenders());
    return Array.isArray(parsed)
      ? normalizeBankSenders(
          parsed.filter((value): value is string => typeof value === 'string'),
        )
      : [];
  } catch {
    return [];
  }
}

export async function setBankSenders(senders: readonly string[]): Promise<void> {
  if (!NativeWalletCaptures) {
    return;
  }
  await NativeWalletCaptures.setBankSenders(normalizeBankSenders(senders));
}
