import NativeAppLock from './specs/NativeAppLock';

export type AppLockStatus = {
  enabled: boolean;
  /** Epoch ms until which no attempt is accepted; 0 when there is no wait. */
  lockedUntil: number;
};

export type PinAttempt = { ok: boolean; lockedUntil: number };

export type AppLockErrorCode =
  | 'unavailable'
  | 'invalid'
  | 'already_enabled'
  | 'no_device_lock'
  | 'cancelled'
  | 'busy'
  | 'failed';

/** An app-lock operation failed. Never carries the PIN. */
export class AppLockError extends Error {
  readonly code: AppLockErrorCode;

  constructor(code: AppLockErrorCode) {
    super(`App lock failed: ${code}`);
    this.name = 'AppLockError';
    this.code = code;
  }
}

const CODES: Record<string, AppLockErrorCode> = {
  E_INVALID: 'invalid',
  E_ALREADY: 'already_enabled',
  E_NO_DEVICE_LOCK: 'no_device_lock',
  E_NO_ACTIVITY: 'unavailable',
  E_BUSY: 'busy',
  E_CANCELLED: 'cancelled',
};

function toError(error: unknown): AppLockError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return new AppLockError(CODES[code] ?? 'failed');
}

function nativeModule() {
  if (!NativeAppLock) {
    throw new AppLockError('unavailable');
  }
  return NativeAppLock;
}

function parse<T extends object>(json: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null
      ? { ...fallback, ...(value as Partial<T>) }
      : fallback;
  } catch {
    return fallback;
  }
}

const REJECTED: PinAttempt = { ok: false, lockedUntil: 0 };

/** The PIN lock only exists where the native module does (Android). */
export function isAppLockSupported(): boolean {
  return NativeAppLock !== null;
}

export async function getAppLockStatus(): Promise<AppLockStatus> {
  if (!NativeAppLock) {
    return { enabled: false, lockedUntil: 0 };
  }
  const status = parse(await NativeAppLock.getStatus(), {
    enabled: false,
    lockedUntil: 0,
  });
  return {
    enabled: status.enabled === true,
    lockedUntil: Number(status.lockedUntil) || 0,
  };
}

async function attempt(call: () => Promise<string>): Promise<PinAttempt> {
  try {
    const result = parse(await call(), REJECTED);
    return {
      ok: result.ok === true,
      lockedUntil: Number(result.lockedUntil) || 0,
    };
  } catch (error) {
    throw toError(error);
  }
}

export function verifyPin(pin: string): Promise<PinAttempt> {
  const lock = nativeModule();
  return attempt(() => lock.verify(pin));
}

export function changePin(current: string, next: string): Promise<PinAttempt> {
  const lock = nativeModule();
  return attempt(() => lock.change(current, next));
}

export function disablePin(current: string): Promise<PinAttempt> {
  const lock = nativeModule();
  return attempt(() => lock.disable(current));
}

export async function enablePin(pin: string): Promise<void> {
  try {
    await nativeModule().enable(pin);
  } catch (error) {
    throw error instanceof AppLockError ? error : toError(error);
  }
}

export async function resetPinWithDeviceCredential(next: string): Promise<void> {
  try {
    await nativeModule().resetWithDeviceCredential(next);
  } catch (error) {
    throw error instanceof AppLockError ? error : toError(error);
  }
}
