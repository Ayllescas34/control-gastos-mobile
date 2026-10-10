import type { EntityId } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
import type {
  SavingsGoal,
  SavingsGoalProgress,
  SavingsGoalStatus,
  SavingsOverview,
} from './types';

/** Progress of one goal given its account's balance. Integer-only comparisons. */
export function evaluateSavingsGoal(
  goal: SavingsGoal,
  savedMinor: MinorUnits,
  currency: CurrencyCode,
): SavingsGoalProgress {
  return {
    goal,
    currency,
    savedMinor,
    remainingMinor: goal.targetAmountMinor - savedMinor,
    status: savedMinor >= goal.targetAmountMinor ? 'reached' : 'in_progress',
  };
}

/**
 * Matches active goals with the derived balances of their accounts (as returned by
 * transactionRepository.listAccountBalances). The balance is the saved amount; the
 * account's currency is the goal's. An account missing from `balances` (never expected:
 * an account with an active goal cannot be archived) counts as zero saved.
 */
export function buildSavingsOverview(
  goals: readonly SavingsGoal[],
  balances: Readonly<Record<EntityId, MinorUnits>>,
  accounts: readonly { id: EntityId; currency: CurrencyCode }[],
): SavingsOverview {
  const currencies = new Map(accounts.map(a => [a.id, a.currency]));
  return {
    goals: goals.map(goal =>
      evaluateSavingsGoal(
        goal,
        balances[goal.accountId] ?? 0,
        currencies.get(goal.accountId) ?? '',
      ),
    ),
  };
}

const STATUS_ORDER: Record<SavingsGoalStatus, number> = {
  in_progress: 0,
  reached: 1,
};

/**
 * In progress first, then reached. Within a status, the nearest target date first (goals
 * without one last), then by name.
 */
export function sortSavingsGoals(
  progress: readonly SavingsGoalProgress[],
): SavingsGoalProgress[] {
  const dateKey = (p: SavingsGoalProgress) => p.goal.targetDate ?? '9999-99-99';
  return [...progress].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      dateKey(a).localeCompare(dateKey(b)) ||
      a.goal.name.localeCompare(b.goal.name, 'es'),
  );
}
