import type { BudgetValidationError } from './validateBudget';

/** Thrown before writing when validateBudget() reports broken rules. */
export class InvalidBudgetError extends Error {
  readonly errors: BudgetValidationError[];

  constructor(errors: BudgetValidationError[]) {
    super(`Invalid budget: ${errors.join(', ')}`);
    this.name = 'InvalidBudgetError';
    this.errors = errors;
  }
}

/** The budget to update no longer exists or was archived meanwhile. */
export class BudgetNotAvailableError extends Error {
  constructor() {
    super('The budget is no longer available');
    this.name = 'BudgetNotAvailableError';
  }
}
