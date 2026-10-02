import type { EntityId } from '../../../shared/domain';
import type { NewCard } from '../data/cardRepository';
import type { Card } from '../domain/types';
import {
  validateCardFields,
  type CardValidationError,
} from '../domain/validateCard';
import { CARD_ERROR_MESSAGES } from './accountMessages';
import { NO_NETWORK, type CardNetworkChoice } from './accountVisuals';

export type CardFormValues = {
  alias: string;
  last4: string;
  network: CardNetworkChoice;
  accountId: EntityId | null;
};

export type CardFormField = keyof CardFormValues;
export type CardFormErrors = Partial<Record<CardFormField, string>>;

export type CardFormResult =
  | { ok: true; input: NewCard }
  | { ok: false; errors: CardFormErrors };

const FIELD_OF_ERROR: Record<CardValidationError, CardFormField> = {
  alias_required: 'alias',
  alias_too_long: 'alias',
  last4_invalid: 'last4',
  network_invalid: 'network',
  account_required: 'accountId',
  account_not_found: 'accountId',
};

export function emptyCardForm(accountId: EntityId | null): CardFormValues {
  return { alias: '', last4: '', network: NO_NETWORK, accountId };
}

export function cardToFormValues(card: Card): CardFormValues {
  return {
    alias: card.alias,
    last4: card.last4,
    network: card.network ?? NO_NETWORK,
    accountId: card.accountId,
  };
}

/** Maps a domain error code to the form field it belongs to (e.g. from the repository). */
export function cardFieldOfError(code: CardValidationError): CardFormField {
  return FIELD_OF_ERROR[code];
}

/**
 * Turns form values into a domain input and runs the card's field rules
 * (validateCardFields). Whether the account is still active is checked by the repository.
 */
export function parseCardForm(values: CardFormValues): CardFormResult {
  const input: NewCard = {
    accountId: values.accountId ?? '',
    alias: values.alias.trim(),
    last4: values.last4.trim(),
    network: values.network === NO_NETWORK ? null : values.network,
  };

  const errors: CardFormErrors = {};
  for (const code of validateCardFields(input)) {
    errors[FIELD_OF_ERROR[code]] ??= CARD_ERROR_MESSAGES[code];
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, input };
}
