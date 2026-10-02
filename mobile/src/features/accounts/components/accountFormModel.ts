import {
  formatMoneyInput,
  parseMoney,
  type CurrencyCode,
} from '../../../shared/lib/money';
import type { NewAccount } from '../data/accountRepository';
import type { Account, AccountType } from '../domain/types';
import {
  validateAccount,
  type AccountValidationError,
} from '../domain/validateAccount';
import { ACCOUNT_ERROR_MESSAGES } from './accountMessages';

/** What the user typed. Money stays text until it is parsed into minor units. */
export type AccountFormValues = {
  name: string;
  type: AccountType | null;
  initialBalance: string;
};

export type AccountFormField = keyof AccountFormValues;
export type AccountFormErrors = Partial<Record<AccountFormField, string>>;

export type AccountFormResult =
  | { ok: true; input: NewAccount }
  | { ok: false; errors: AccountFormErrors };

const FIELD_OF_ERROR: Record<AccountValidationError, AccountFormField> = {
  name_required: 'name',
  name_too_long: 'name',
  type_invalid: 'type',
  currency_invalid: 'initialBalance',
  initial_balance_invalid: 'initialBalance',
};

const MONEY_ERROR_MESSAGES = {
  invalid: 'Escribe un monto como 1500 o 1,500.50.',
  too_many_decimals: 'Usa como máximo 2 decimales.',
  too_large: 'El monto es demasiado grande.',
} as const;

export const EMPTY_ACCOUNT_FORM: AccountFormValues = {
  name: '',
  type: null,
  initialBalance: '',
};

export function accountToFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    initialBalance: formatMoneyInput(
      account.initialBalanceMinor,
      account.currency,
    ),
  };
}

/**
 * Turns form values into a domain input: trims the name, parses the balance into integer
 * minor units (an empty balance means 0) and runs validateAccount. Rules are not
 * re-implemented here; their codes are only mapped to fields and messages.
 */
export function parseAccountForm(
  values: AccountFormValues,
  currency: CurrencyCode,
): AccountFormResult {
  const errors: AccountFormErrors = {};

  let initialBalanceMinor = 0;
  if (values.initialBalance.trim() !== '') {
    const parsed = parseMoney(values.initialBalance, currency);
    if (parsed.ok) {
      initialBalanceMinor = parsed.amountMinor;
    } else if (parsed.error !== 'empty') {
      errors.initialBalance = MONEY_ERROR_MESSAGES[parsed.error];
    }
  }

  const name = values.name.trim();
  // An unselected type (null) is reported by validateAccount as type_invalid.
  const validation = validateAccount({
    name,
    type: values.type,
    currency,
    initialBalanceMinor,
  });
  for (const code of validation.errors) {
    errors[FIELD_OF_ERROR[code]] ??= ACCOUNT_ERROR_MESSAGES[code];
  }

  if (Object.keys(errors).length > 0 || values.type === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: { name, type: values.type, currency, initialBalanceMinor },
  };
}
