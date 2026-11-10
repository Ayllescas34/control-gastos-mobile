import { isCurrencyCode } from '../../../shared/lib/money';
import { ACCOUNT_TYPES, type Account } from './types';

export const ACCOUNT_NAME_MAX_LENGTH = 60;
export const BANK_LABEL_MAX_LENGTH = 80;

/** One identifier: letters, digits and the masks banks use ("****1234", "BICHEQUE3"). */
const BANK_LABEL_PART = /^[\p{L}\p{N}*•#-]{2,30}$/u;

/**
 * The identifiers in a bank label, normalized for matching: trimmed, upper case, no
 * duplicates. "tcredito, BICHEQUE3" → ["TCREDITO", "BICHEQUE3"].
 */
export function parseBankLabels(label: string | null): string[] {
  if (label === null) {
    return [];
  }
  const parts = label
    .split(',')
    .map(part => part.trim().toUpperCase())
    .filter(part => part.length > 0);
  return [...new Set(parts)];
}

export type AccountValidationError =
  | 'name_required'
  | 'name_too_long'
  | 'type_invalid'
  | 'currency_invalid'
  | 'initial_balance_invalid'
  | 'bank_label_invalid';

export type AccountValidationResult = {
  valid: boolean;
  errors: AccountValidationError[];
};

/**
 * The fields an account's rules depend on (all checkable without I/O). `type` is widened
 * because the validator checks untrusted input, such as a form with no type chosen yet.
 */
export type AccountFields = Pick<
  Account,
  'name' | 'currency' | 'initialBalanceMinor'
> & { type: string | null; bankLabel?: string | null };

/**
 * Pure domain validation of an account: no I/O, no state. Returns every broken rule.
 * Money is an integer in minor units (signed: a negative initial balance is debt).
 */
export function validateAccount(
  account: AccountFields,
): AccountValidationResult {
  const errors: AccountValidationError[] = [];

  const name = account.name.trim();
  if (name.length === 0) {
    errors.push('name_required');
  } else if (name.length > ACCOUNT_NAME_MAX_LENGTH) {
    errors.push('name_too_long');
  }
  if (
    account.type === null ||
    !(ACCOUNT_TYPES as readonly string[]).includes(account.type)
  ) {
    errors.push('type_invalid');
  }
  if (!isCurrencyCode(account.currency)) {
    errors.push('currency_invalid');
  }
  if (!Number.isSafeInteger(account.initialBalanceMinor)) {
    errors.push('initial_balance_invalid');
  }
  const bankLabel = account.bankLabel ?? null;
  if (
    bankLabel !== null &&
    (bankLabel.length > BANK_LABEL_MAX_LENGTH ||
      parseBankLabels(bankLabel).length === 0 ||
      !parseBankLabels(bankLabel).every(part => BANK_LABEL_PART.test(part)))
  ) {
    errors.push('bank_label_invalid');
  }

  return { valid: errors.length === 0, errors };
}
