import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Codegen spec of the Android module AppLockModule (app PIN, docs/security.md). Only Android
 * implements it; use core/native/appLock.ts, never this module directly.
 *
 * JSON results: status {enabled, lockedUntil}; attempts {ok, lockedUntil}. lockedUntil is an
 * epoch in ms, 0 when there is no wait.
 * Rejection codes: E_INVALID (not 6 digits), E_ALREADY (a PIN exists), E_NO_DEVICE_LOCK (the
 * phone has no screen lock), E_NO_ACTIVITY, E_BUSY, E_CANCELLED, E_FAILED.
 */
export interface Spec extends TurboModule {
  getStatus(): Promise<string>;
  enable(pin: string): Promise<void>;
  verify(pin: string): Promise<string>;
  change(current: string, next: string): Promise<string>;
  disable(current: string): Promise<string>;
  /** Shows the phone's own lock screen; on success the new PIN replaces the old one. */
  resetWithDeviceCredential(next: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('AppLock');
