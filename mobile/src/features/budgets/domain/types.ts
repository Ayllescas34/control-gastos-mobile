import type { EntityId, LocalDate, Timestamps } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

/**
 * Recurring monthly spending limit of one expense category in one currency
 * (docs/budgets.md). Only `amountMinor` changes after creation; the period is always the
 * current month, so no dates are stored.
 */
export type Budget = Timestamps & {
  id: EntityId;
  /** Expense category it limits. */
  categoryId: EntityId;
  /** Monthly limit: integer > 0 in minor units. */
  amountMinor: MinorUnits;
  currency: CurrencyCode;
};

/**
 * - ok: more than 20% of the limit left.
 * - warning: 20% or less left, still under the limit.
 * - reached: spent exactly the limit.
 * - exceeded: spent more than the limit.
 */
export type BudgetStatus = 'ok' | 'warning' | 'reached' | 'exceeded';

export type BudgetProgress = {
  budget: Budget;
  /** Expenses of the period in the budget's category and currency. */
  spentMinor: MinorUnits;
  /** amountMinor − spentMinor; negative when exceeded. */
  remainingMinor: MinorUnits;
  status: BudgetStatus;
};

/** Expenses of a category (null: uncategorized) with no active budget in that currency. */
export type UnbudgetedSpending = {
  categoryId: EntityId | null;
  currency: CurrencyCode;
  spentMinor: MinorUnits;
};

export type BudgetOverview = {
  /** Inclusive civil-date range of the current month. */
  period: { from: LocalDate; to: LocalDate };
  budgets: BudgetProgress[];
  unbudgeted: UnbudgetedSpending[];
};
