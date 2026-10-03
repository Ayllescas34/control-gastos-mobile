import type { EntityId } from '../../../shared/domain';
import { isCurrencyCode } from '../../../shared/lib/money';
import type { Budget } from './types';

export type BudgetValidationError =
  | 'category_required'
  | 'category_not_found'
  | 'category_not_expense'
  | 'category_archived'
  | 'amount_invalid'
  | 'currency_invalid'
  | 'budget_duplicate';

export type BudgetValidationResult = {
  valid: boolean;
  errors: BudgetValidationError[];
};

/** The fields a budget's rules depend on. `categoryId` is null while none is chosen. */
export type BudgetFields = Pick<Budget, 'amountMinor' | 'currency'> & {
  categoryId: EntityId | null;
};

export type BudgetValidationContext = {
  /** The budget's category (archived ones included), or null when it does not exist. */
  category: { id: EntityId; kind: string; deletedAt: string | null } | null;
  /** Active budgets, for the one-per-category-and-currency rule. */
  existing: readonly Pick<Budget, 'id' | 'categoryId' | 'currency'>[];
  /**
   * When editing, the budget itself: it is not its own duplicate, and it keeps a category
   * archived after it was created.
   */
  currentId?: EntityId;
};

/**
 * Pure domain validation: no I/O. Returns every broken rule. A new budget needs an active
 * expense category; the limit is a positive safe integer in minor units.
 */
export function validateBudget(
  budget: BudgetFields,
  context: BudgetValidationContext,
): BudgetValidationResult {
  const errors: BudgetValidationError[] = [];
  const { category } = context;

  if (budget.categoryId === null) {
    errors.push('category_required');
  } else if (!category || category.id !== budget.categoryId) {
    errors.push('category_not_found');
  } else {
    if (category.kind !== 'expense') {
      errors.push('category_not_expense');
    }
    if (category.deletedAt !== null && context.currentId === undefined) {
      errors.push('category_archived');
    }
  }

  if (!Number.isSafeInteger(budget.amountMinor) || budget.amountMinor <= 0) {
    errors.push('amount_invalid');
  }

  const currencyValid = isCurrencyCode(budget.currency);
  if (!currencyValid) {
    errors.push('currency_invalid');
  }

  if (budget.categoryId !== null && currencyValid) {
    const duplicate = context.existing.some(
      other =>
        other.id !== context.currentId &&
        other.categoryId === budget.categoryId &&
        other.currency === budget.currency,
    );
    if (duplicate) {
      errors.push('budget_duplicate');
    }
  }

  return { valid: errors.length === 0, errors };
}
