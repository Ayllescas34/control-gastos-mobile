import { InvalidTransactionError } from '../data/transactionRepository';
import type { TransactionValidationError } from '../domain/validateTransaction';

/** User-facing text for each domain rule. The rules themselves live in the domain. */
export const TRANSACTION_ERROR_MESSAGES: Record<
  TransactionValidationError,
  string
> = {
  amount_not_integer: 'El monto no es válido.',
  amount_not_positive: 'El monto debe ser mayor que cero.',
  to_account_not_allowed: 'Solo una transferencia tiene cuenta destino.',
  to_account_required: 'Elige la cuenta destino.',
  to_account_same_as_account:
    'La cuenta destino debe ser distinta de la de origen.',
  category_not_allowed_for_transfer: 'Una transferencia no lleva categoría.',
  card_not_allowed_for_transfer: 'Una transferencia no lleva tarjeta.',
  card_not_in_account: 'La tarjeta no pertenece a la cuenta elegida.',
  local_date_invalid: 'Escribe una fecha válida (AAAA-MM-DD).',
  account_not_found: 'La cuenta elegida ya no está disponible.',
  to_account_not_found: 'La cuenta destino ya no está disponible.',
  currency_mismatch: 'Las cuentas deben usar la misma moneda.',
  category_not_found: 'La categoría elegida ya no está disponible.',
  category_kind_mismatch:
    'La categoría no corresponde a este tipo de movimiento.',
};

/** Thrown when the transaction to edit no longer exists or was archived meanwhile. */
export class TransactionNotAvailableError extends Error {
  constructor() {
    super('The transaction is no longer available');
    this.name = 'TransactionNotAvailableError';
  }
}

/** Message for a failed load or save. Domain errors are explained; others stay generic. */
export function describeTransactionsError(error: unknown): string {
  if (error instanceof TransactionNotAvailableError) {
    return 'El movimiento ya no está disponible. Puede que haya sido archivado.';
  }
  if (error instanceof InvalidTransactionError) {
    return error.errors.map(code => TRANSACTION_ERROR_MESSAGES[code]).join(' ');
  }
  return 'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.';
}
