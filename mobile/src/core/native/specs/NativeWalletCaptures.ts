import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Codegen spec of the Android module WalletCapturesModule: Google Wallet payment
 * notifications and bank SMS (from the configured senders) queued by
 * WalletNotificationListener. Only Android implements it; use
 * core/native/walletCaptures.ts, never this module directly.
 *
 * Rejection codes: E_UNAVAILABLE (no settings screen for notification access).
 */
export interface Spec extends TurboModule {
  /** Whether the user granted "Acceso a notificaciones" to the app's listener. */
  isAccessGranted(): Promise<boolean>;
  /** Opens the system screen where the user grants notification access. */
  openAccessSettings(): Promise<void>;
  /** JSON array of the queued notifications not yet acknowledged. */
  readPending(): Promise<string>;
  /** Removes these ids from the queue once they are safely stored in SQLite. */
  acknowledge(ids: ReadonlyArray<string>): Promise<void>;
  /** JSON array of the bank SMS senders/prefixes whose messages are captured. */
  getBankSenders(): Promise<string>;
  /** Replaces them. Messages from anyone else are discarded natively, never stored. */
  setBankSenders(senders: ReadonlyArray<string>): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('WalletCaptures');
