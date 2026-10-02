import type { AccountValidationError } from './validateAccount';
import type { CardValidationError } from './validateCard';

/** Thrown before writing when validateAccount() reports broken rules. */
export class InvalidAccountError extends Error {
  readonly errors: AccountValidationError[];

  constructor(errors: AccountValidationError[]) {
    super(`Invalid account: ${errors.join(', ')}`);
    this.name = 'InvalidAccountError';
    this.errors = errors;
  }
}

/** Thrown before writing when validateCard() reports broken rules. */
export class InvalidCardError extends Error {
  readonly errors: CardValidationError[];

  constructor(errors: CardValidationError[]) {
    super(`Invalid card: ${errors.join(', ')}`);
    this.name = 'InvalidCardError';
    this.errors = errors;
  }
}

/**
 * An account with active cards cannot be archived: its cards would be left pointing to
 * a hidden account. Archiving never cascades; the cards must be archived first.
 */
export class AccountHasActiveCardsError extends Error {
  readonly activeCardCount: number;

  constructor(activeCardCount: number) {
    super(`Account has ${activeCardCount} active card(s)`);
    this.name = 'AccountHasActiveCardsError';
    this.activeCardCount = activeCardCount;
  }
}

/** The account or card to update no longer exists or was archived meanwhile. */
export class EntityNotAvailableError extends Error {
  readonly entity: 'account' | 'card';

  constructor(entity: 'account' | 'card') {
    super(`The ${entity} is no longer available`);
    this.name = 'EntityNotAvailableError';
    this.entity = entity;
  }
}
