import type {
  EntityId,
  IsoDateTime,
  Timestamps,
} from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

/**
 * - new: waiting in "Por revisar" (no card matched, or the currency differs).
 * - registered: became the movement `transactionId`.
 * - dismissed: the user said it is not a movement to record.
 */
export type WalletCaptureStatus = 'new' | 'registered' | 'dismissed';

/** What a captured message describes. A withdrawal moves cash out of an account. */
export type CaptureKind = 'expense' | 'income' | 'withdrawal';

/**
 * A movement read from a notification: a Google Wallet payment (docs/google-wallet.md) or a
 * bank SMS (docs/bank-messages.md).
 */
export type WalletCapture = Timestamps & {
  id: EntityId;
  externalRef: string;
  sourceApp: string;
  rawTitle: string | null;
  rawText: string | null;
  merchant: string | null;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  cardLast4: string | null;
  /** The account as the bank named it in an SMS ("TCREDITO"). */
  accountLabel: string | null;
  kind: CaptureKind;
  /** When the movement happened (the bank's own date for SMS). */
  postedAt: IsoDateTime;
  status: WalletCaptureStatus;
  transactionId: EntityId | null;
};

/** What a payment notification says, once parsed. */
export type ParsedWalletPayment = {
  merchant: string | null;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  cardLast4: string | null;
};
