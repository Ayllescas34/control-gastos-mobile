import type { EntityId } from '../../../shared/domain';
import {
  formatMoneyInput,
  parseMoney,
  type CurrencyCode,
} from '../../../shared/lib/money';
import type { NewBudget } from '../data/budgetRepository';
import type { Budget } from '../domain/types';
import {
  validateBudget,
  type BudgetValidationContext,
  type BudgetValidationError,
} from '../domain/validateBudget';
import { BUDGET_ERROR_MESSAGES } from './budgetMessages';

export type BudgetFormValues = {
  categoryId: EntityId | null;
  /** Limit as typed, e.g. "2,000" or "1500.50". */
  amount: string;
};

export type BudgetFormField = keyof BudgetFormValues;
export type BudgetFormErrors = Partial<Record<BudgetFormField, string>>;

export type BudgetFormResult =
  | { ok: true; input: NewBudget }
  | { ok: false; errors: BudgetFormErrors };

const FIELD_OF_ERROR: Record<BudgetValidationError, BudgetFormField> = {
  category_required: 'categoryId',
  category_not_found: 'categoryId',
  category_not_expense: 'categoryId',
  category_archived: 'categoryId',
  budget_duplicate: 'categoryId',
  amount_invalid: 'amount',
  // The currency is fixed by the app; a failure is shown next to the amount.
  currency_invalid: 'amount',
};

const MONEY_ERROR_MESSAGES = {
  empty: 'Escribe el monto del presupuesto.',
  invalid: 'Escribe un monto como 2000 o 1,500.50.',
  too_many_decimals: 'Usa como máximo 2 decimales.',
  too_large: 'El monto es demasiado grande.',
} as const;

export function budgetFieldOfError(
  code: BudgetValidationError,
): BudgetFormField {
  return FIELD_OF_ERROR[code];
}

export function emptyBudgetForm(categoryId: EntityId | null): BudgetFormValues {
  return { categoryId, amount: '' };
}

export function budgetToFormValues(budget: Budget): BudgetFormValues {
  return {
    categoryId: budget.categoryId,
    amount: formatMoneyInput(budget.amountMinor, budget.currency),
  };
}

/**
 * Turns form values into a domain input (amount parsed with parseMoney, no floating
 * point) and runs validateBudget against what the user sees. The repository validates
 * again before writing.
 */
export function parseBudgetForm(
  values: BudgetFormValues,
  currency: CurrencyCode,
  context: BudgetValidationContext,
): BudgetFormResult {
  const errors: BudgetFormErrors = {};
  const parsed = parseMoney(values.amount, currency);
  if (!parsed.ok) {
    errors.amount = MONEY_ERROR_MESSAGES[parsed.error];
  }

  const amountMinor = parsed.ok ? parsed.amountMinor : 0;
  for (const code of validateBudget(
    { categoryId: values.categoryId, amountMinor, currency },
    context,
  ).errors) {
    // An unparsable amount already has a clearer message.
    if (FIELD_OF_ERROR[code] !== 'amount' || parsed.ok) {
      errors[FIELD_OF_ERROR[code]] ??= BUDGET_ERROR_MESSAGES[code];
    }
  }

  if (Object.keys(errors).length > 0 || values.categoryId === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: { categoryId: values.categoryId, amountMinor, currency },
  };
}
