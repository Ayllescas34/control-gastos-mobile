import type { EntityId } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
import type {
  Budget,
  BudgetOverview,
  BudgetProgress,
  BudgetStatus,
} from './types';

/** Expenses of the period per category and currency, as summed by SQL. */
export type CategoryExpenseTotals = readonly {
  categoryId: EntityId | null;
  currency: CurrencyCode;
  totalMinor: MinorUnits;
}[];

/**
 * Integer-only status: warning when 20% of the limit or less is left. The comparison uses
 * floor(amount / 5) instead of percentages, so it is exact and never overflows (remaining
 * is an integer, so remaining ≤ amount/5 ⇔ remaining ≤ floor(amount/5)).
 */
function statusOf(
  amountMinor: MinorUnits,
  spentMinor: MinorUnits,
): BudgetStatus {
  if (spentMinor > amountMinor) {
    return 'exceeded';
  }
  if (spentMinor === amountMinor) {
    return 'reached';
  }
  return amountMinor - spentMinor <= Math.floor(amountMinor / 5)
    ? 'warning'
    : 'ok';
}

/** Progress of one budget given what was spent in its category and currency. */
export function evaluateBudget(
  budget: Budget,
  spentMinor: MinorUnits,
): BudgetProgress {
  return {
    budget,
    spentMinor,
    remainingMinor: budget.amountMinor - spentMinor,
    status: statusOf(budget.amountMinor, spentMinor),
  };
}

const key = (categoryId: EntityId | null, currency: CurrencyCode) =>
  `${categoryId ?? ''} ${currency}`;

/**
 * Matches active budgets with the period's expense totals by category and currency (never
 * across currencies). Totals with no budget (uncategorized ones included) become
 * `unbudgeted`, in the order SQL returned them (largest first).
 */
export function buildBudgetOverview(
  budgets: readonly Budget[],
  totals: CategoryExpenseTotals,
  period: BudgetOverview['period'],
): BudgetOverview {
  const spent = new Map<string, MinorUnits>();
  for (const total of totals) {
    const k = key(total.categoryId, total.currency);
    spent.set(k, (spent.get(k) ?? 0) + total.totalMinor);
  }
  const budgeted = new Set(budgets.map(b => key(b.categoryId, b.currency)));

  return {
    period,
    budgets: budgets.map(budget =>
      evaluateBudget(
        budget,
        spent.get(key(budget.categoryId, budget.currency)) ?? 0,
      ),
    ),
    unbudgeted: totals
      .filter(total => !budgeted.has(key(total.categoryId, total.currency)))
      .map(total => ({
        categoryId: total.categoryId,
        currency: total.currency,
        spentMinor: total.totalMinor,
      })),
  };
}

const STATUS_ORDER: Record<BudgetStatus, number> = {
  exceeded: 0,
  warning: 1,
  reached: 2,
  ok: 3,
};

/** Exceeded first, then warning, reached and ok; by category name within a status. */
export function sortBudgetProgress(
  progress: readonly BudgetProgress[],
  categoryName: (categoryId: EntityId) => string,
): BudgetProgress[] {
  return [...progress].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      categoryName(a.budget.categoryId).localeCompare(
        categoryName(b.budget.categoryId),
        'es',
      ),
  );
}
