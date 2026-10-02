import {
  AccountHasActiveCardsError,
  EntityNotAvailableError,
  InvalidAccountError,
  InvalidCardError,
} from '../domain/accountErrors';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  type AccountValidationError,
} from '../domain/validateAccount';
import {
  CARD_ALIAS_MAX_LENGTH,
  type CardValidationError,
} from '../domain/validateCard';

/** User-facing text for each domain rule. The rules themselves live in the domain. */
export const ACCOUNT_ERROR_MESSAGES: Record<AccountValidationError, string> = {
  name_required: 'Escribe un nombre para la cuenta.',
  name_too_long: `El nombre puede tener hasta ${ACCOUNT_NAME_MAX_LENGTH} caracteres.`,
  type_invalid: 'Elige el tipo de cuenta.',
  currency_invalid: 'La moneda no es válida.',
  initial_balance_invalid: 'El saldo inicial no es válido.',
};

export const CARD_ERROR_MESSAGES: Record<CardValidationError, string> = {
  alias_required: 'Escribe un nombre para identificar la tarjeta.',
  alias_too_long: `El nombre puede tener hasta ${CARD_ALIAS_MAX_LENGTH} caracteres.`,
  last4_invalid: 'Escribe solo los últimos 4 dígitos de la tarjeta.',
  network_invalid: 'Elige una red válida.',
  account_required: 'Elige la cuenta de la tarjeta.',
  account_not_found: 'La cuenta elegida ya no está disponible.',
};

export const ARCHIVE_BLOCKED_MESSAGE =
  'Esta cuenta tiene tarjetas activas. Archiva primero sus tarjetas.';

/** Message for a failed load or save. Domain errors are explained; others stay generic. */
export function describeAccountsError(error: unknown): string {
  if (error instanceof AccountHasActiveCardsError) {
    return ARCHIVE_BLOCKED_MESSAGE;
  }
  if (error instanceof EntityNotAvailableError) {
    return error.entity === 'account'
      ? 'La cuenta ya no está disponible. Puede que haya sido archivada.'
      : 'La tarjeta ya no está disponible. Puede que haya sido archivada.';
  }
  if (error instanceof InvalidAccountError) {
    return error.errors.map(code => ACCOUNT_ERROR_MESSAGES[code]).join(' ');
  }
  if (error instanceof InvalidCardError) {
    return error.errors.map(code => CARD_ERROR_MESSAGES[code]).join(' ');
  }
  return 'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.';
}
