import { CARD_NETWORKS, type Account, type Card } from './types';

export const CARD_ALIAS_MAX_LENGTH = 40;

export type CardValidationError =
  | 'alias_required'
  | 'alias_too_long'
  | 'last4_invalid'
  | 'network_invalid'
  | 'account_required'
  | 'account_not_found';

export type CardValidationResult = {
  valid: boolean;
  errors: CardValidationError[];
};

/**
 * Exactly four digits. Rejecting anything longer means a full card number can never be
 * stored by mistake (SECURITY: no PAN, CVV, PIN or expiration date, ever).
 */
const LAST4 = /^\d{4}$/;

export type CardFields = Pick<
  Card,
  'accountId' | 'alias' | 'last4' | 'network'
>;

/** Other entities needed for rules that cannot be checked from the card alone. */
export type CardValidationContext = {
  /** The card's account if it exists and is active, otherwise null. */
  account: Pick<Account, 'id'> | null;
};

/** Rules that only need the card itself. */
export function validateCardFields(card: CardFields): CardValidationError[] {
  const errors: CardValidationError[] = [];

  const alias = card.alias.trim();
  if (alias.length === 0) {
    errors.push('alias_required');
  } else if (alias.length > CARD_ALIAS_MAX_LENGTH) {
    errors.push('alias_too_long');
  }
  if (!LAST4.test(card.last4)) {
    errors.push('last4_invalid');
  }
  if (
    card.network !== null &&
    !(CARD_NETWORKS as readonly string[]).includes(card.network)
  ) {
    errors.push('network_invalid');
  }
  if (card.accountId.length === 0) {
    errors.push('account_required');
  }

  return errors;
}

/**
 * Pure domain validation of a card: no I/O. A card belongs to an existing, active account
 * (domain-model rule 11). Credit vs debit is not a card field: it comes from the account
 * type, so any account type may hold cards.
 */
export function validateCard(
  card: CardFields,
  context: CardValidationContext,
): CardValidationResult {
  const errors = validateCardFields(card);
  if (card.accountId.length > 0 && context.account?.id !== card.accountId) {
    errors.push('account_not_found');
  }
  return { valid: errors.length === 0, errors };
}
