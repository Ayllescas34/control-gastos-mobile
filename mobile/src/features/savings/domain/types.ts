import type { EntityId, LocalDate, Timestamps } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

/**
 * "I want `targetAmountMinor` accumulated in this account" (docs/savings.md). A goal holds
 * no money of its own: what is saved is the account's derived balance, in the account's
 * currency, so neither the saved amount, the currency nor a status is stored.
 */
export type SavingsGoal = Timestamps & {
  id: EntityId;
  /** The account whose balance is the saved amount. Fixed after creation. */
  accountId: EntityId;
  name: string;
  /** Integer > 0 in the account currency's minor units. */
  targetAmountMinor: MinorUnits;
  /** Optional and informative only: a past date changes nothing. */
  targetDate: LocalDate | null;
};

/**
 * Derived from the balance, never stored:
 * - in_progress: saved < target (negative balances included).
 * - reached: saved ≥ target.
 */
export type SavingsGoalStatus = 'in_progress' | 'reached';

export type SavingsGoalProgress = {
  goal: SavingsGoal;
  /** The account's currency (goals have none of their own). */
  currency: CurrencyCode;
  /** The account's current balance: may be negative or exceed the target. */
  savedMinor: MinorUnits;
  /** targetAmountMinor − savedMinor; negative when the goal is surpassed. */
  remainingMinor: MinorUnits;
  status: SavingsGoalStatus;
};

export type SavingsOverview = {
  goals: SavingsGoalProgress[];
};
