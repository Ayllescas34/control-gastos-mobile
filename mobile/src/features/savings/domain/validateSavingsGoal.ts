import type { EntityId } from '../../../shared/domain';
import { isValidLocalDate } from '../../../shared/lib/dates';
import type { SavingsGoal } from './types';

export const SAVINGS_GOAL_NAME_MAX_LENGTH = 60;

export type SavingsGoalValidationError =
  | 'name_required'
  | 'name_too_long'
  | 'target_invalid'
  | 'target_date_invalid'
  | 'account_required'
  | 'account_not_found'
  | 'account_archived'
  | 'account_type_invalid'
  | 'account_has_goal';

export type SavingsGoalValidationResult = {
  valid: boolean;
  errors: SavingsGoalValidationError[];
};

/** The fields a goal's rules depend on. `accountId` is null while none is chosen. */
export type SavingsGoalFields = Pick<
  SavingsGoal,
  'name' | 'targetAmountMinor' | 'targetDate'
> & { accountId: EntityId | null };

export type SavingsGoalValidationContext = {
  /** The goal's account (archived ones included), or null when it does not exist. */
  account: { id: EntityId; type: string; deletedAt: string | null } | null;
  /** Active goals, for the one-active-goal-per-account rule. */
  existing: readonly Pick<SavingsGoal, 'id' | 'accountId'>[];
  /**
   * When editing, the goal itself: it is not its own duplicate, and its account (fixed
   * since creation) is not checked again.
   */
  currentId?: EntityId;
};

/**
 * Pure domain validation: no I/O. Returns every broken rule. A new goal needs an active
 * account that is not a credit card (its balance is debt, not savings) and has no other
 * active goal. A past target date is still valid.
 */
export function validateSavingsGoal(
  goal: SavingsGoalFields,
  context: SavingsGoalValidationContext,
): SavingsGoalValidationResult {
  const errors: SavingsGoalValidationError[] = [];
  const creating = context.currentId === undefined;

  const name = goal.name.trim();
  if (name.length === 0) {
    errors.push('name_required');
  } else if (name.length > SAVINGS_GOAL_NAME_MAX_LENGTH) {
    errors.push('name_too_long');
  }

  if (
    !Number.isSafeInteger(goal.targetAmountMinor) ||
    goal.targetAmountMinor <= 0
  ) {
    errors.push('target_invalid');
  }

  if (goal.targetDate !== null && !isValidLocalDate(goal.targetDate)) {
    errors.push('target_date_invalid');
  }

  const { account } = context;
  if (goal.accountId === null) {
    errors.push('account_required');
  } else if (!account || account.id !== goal.accountId) {
    errors.push('account_not_found');
  } else {
    if (creating && account.deletedAt !== null) {
      errors.push('account_archived');
    }
    if (creating && account.type === 'credit_card') {
      errors.push('account_type_invalid');
    }
    const taken = context.existing.some(
      other =>
        other.id !== context.currentId && other.accountId === goal.accountId,
    );
    if (taken) {
      errors.push('account_has_goal');
    }
  }

  return { valid: errors.length === 0, errors };
}
