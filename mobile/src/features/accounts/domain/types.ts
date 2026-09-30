import type { EntityId, Timestamps } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card' | 'other';

/**
 * The current balance is not stored: it is derived from `initialBalanceMinor`
 * plus the account's transactions. See docs/domain-model.md.
 */
export type Account = Timestamps & {
  id: EntityId;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  /** Signed balance when the account was created. Negative means debt (e.g. credit card). */
  initialBalanceMinor: MinorUnits;
};

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'other';

/**
 * Physical/virtual card linked to an account. Credit vs debit comes from the account type.
 * SECURITY: never add the full card number, CVV, PIN or expiration date to this model.
 */
export type Card = Timestamps & {
  id: EntityId;
  accountId: EntityId;
  alias: string;
  /** Exactly 4 digits; a string so leading zeros are preserved. */
  last4: string;
  network: CardNetwork | null;
};
