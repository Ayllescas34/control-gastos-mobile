import type { CategoryValidationError } from './validateCategory';

/** Thrown before writing when validateCategory() reports broken rules. */
export class InvalidCategoryError extends Error {
  readonly errors: CategoryValidationError[];

  constructor(errors: CategoryValidationError[]) {
    super(`Invalid category: ${errors.join(', ')}`);
    this.name = 'InvalidCategoryError';
    this.errors = errors;
  }
}

/** The category to update no longer exists or was archived meanwhile. */
export class CategoryNotAvailableError extends Error {
  constructor() {
    super('The category is no longer available');
    this.name = 'CategoryNotAvailableError';
  }
}
