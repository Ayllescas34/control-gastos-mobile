import type { SavingsGoalValidationError } from './validateSavingsGoal';

/** Thrown before writing when validateSavingsGoal() reports broken rules. */
export class InvalidSavingsGoalError extends Error {
  readonly errors: SavingsGoalValidationError[];

  constructor(errors: SavingsGoalValidationError[]) {
    super(`Invalid savings goal: ${errors.join(', ')}`);
    this.name = 'InvalidSavingsGoalError';
    this.errors = errors;
  }
}

/** The goal to update no longer exists or was archived meanwhile. */
export class SavingsGoalNotAvailableError extends Error {
  constructor() {
    super('The savings goal is no longer available');
    this.name = 'SavingsGoalNotAvailableError';
  }
}
