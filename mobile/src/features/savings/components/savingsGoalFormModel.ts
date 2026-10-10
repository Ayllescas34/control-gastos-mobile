import type { EntityId } from '../../../shared/domain';
import {
  formatMoneyInput,
  parseMoney,
  type CurrencyCode,
} from '../../../shared/lib/money';
import type { NewSavingsGoal } from '../data/savingsGoalRepository';
import type { SavingsGoal } from '../domain/types';
import {
  validateSavingsGoal,
  type SavingsGoalValidationContext,
  type SavingsGoalValidationError,
} from '../domain/validateSavingsGoal';
import { SAVINGS_GOAL_ERROR_MESSAGES } from './savingsMessages';

export type SavingsGoalFormValues = {
  name: string;
  accountId: EntityId | null;
  /** Target as typed, e.g. "10,000" or "1500.50". */
  target: string;
  /** "YYYY-MM-DD", or empty for no target date. */
  targetDate: string;
};

export type SavingsGoalFormField = keyof SavingsGoalFormValues;
export type SavingsGoalFormErrors = Partial<
  Record<SavingsGoalFormField, string>
>;

export type SavingsGoalFormResult =
  | { ok: true; input: NewSavingsGoal }
  | { ok: false; errors: SavingsGoalFormErrors };

const FIELD_OF_ERROR: Record<SavingsGoalValidationError, SavingsGoalFormField> =
  {
    name_required: 'name',
    name_too_long: 'name',
    target_invalid: 'target',
    target_date_invalid: 'targetDate',
    account_required: 'accountId',
    account_not_found: 'accountId',
    account_archived: 'accountId',
    account_type_invalid: 'accountId',
    account_has_goal: 'accountId',
  };

const MONEY_ERROR_MESSAGES = {
  empty: 'Escribe el monto objetivo.',
  invalid: 'Escribe un monto como 10000 o 1,500.50.',
  too_many_decimals: 'Usa como máximo 2 decimales.',
  too_large: 'El monto es demasiado grande.',
} as const;

export function savingsGoalFieldOfError(
  code: SavingsGoalValidationError,
): SavingsGoalFormField {
  return FIELD_OF_ERROR[code];
}

export function emptySavingsGoalForm(): SavingsGoalFormValues {
  return { name: '', accountId: null, target: '', targetDate: '' };
}

export function savingsGoalToFormValues(
  goal: SavingsGoal,
  currency: CurrencyCode,
): SavingsGoalFormValues {
  return {
    name: goal.name,
    accountId: goal.accountId,
    target: formatMoneyInput(goal.targetAmountMinor, currency),
    targetDate: goal.targetDate ?? '',
  };
}

/**
 * Turns form values into a domain input (target parsed with parseMoney in the account's
 * currency, no floating point; an empty date means none) and runs validateSavingsGoal
 * against what the user sees. The repository validates again before writing.
 */
export function parseSavingsGoalForm(
  values: SavingsGoalFormValues,
  currency: CurrencyCode,
  context: SavingsGoalValidationContext,
): SavingsGoalFormResult {
  const errors: SavingsGoalFormErrors = {};
  const parsed = parseMoney(values.target, currency);
  if (!parsed.ok) {
    errors.target = MONEY_ERROR_MESSAGES[parsed.error];
  }

  const name = values.name.trim();
  const targetAmountMinor = parsed.ok ? parsed.amountMinor : 0;
  const date = values.targetDate.trim();
  const targetDate = date === '' ? null : date;
  for (const code of validateSavingsGoal(
    { name, accountId: values.accountId, targetAmountMinor, targetDate },
    context,
  ).errors) {
    // An unparsable target already has a clearer message.
    if (FIELD_OF_ERROR[code] !== 'target' || parsed.ok) {
      errors[FIELD_OF_ERROR[code]] ??= SAVINGS_GOAL_ERROR_MESSAGES[code];
    }
  }

  if (Object.keys(errors).length > 0 || values.accountId === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      accountId: values.accountId,
      name,
      targetAmountMinor,
      targetDate,
    },
  };
}
