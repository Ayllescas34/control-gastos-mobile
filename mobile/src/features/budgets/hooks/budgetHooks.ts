import { useCallback, useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
import { monthRange } from '../../../shared/lib/dates';
// Repositories by module (not the feature index) to keep features free of import cycles.
import { createCategoryRepository } from '../../categories/data/categoryRepository';
import type { Category } from '../../categories/domain/types';
import { createTransactionRepository } from '../../transactions/data/transactionRepository';
import { createBudgetRepository } from '../data/budgetRepository';
import {
  buildBudgetOverview,
  sortBudgetProgress,
} from '../domain/budgetProgress';
import type { Budget, BudgetOverview } from '../domain/types';

/** Every repository the budgets screens read from. Screens never touch SQL. */
export function useBudgetRepositories() {
  const { db } = useDatabase();
  return useMemo(
    () => ({
      budgets: createBudgetRepository(db),
      categories: createCategoryRepository(db),
      /** What a budget has spent comes from the expense totals summed in SQL. */
      transactions: createTransactionRepository(db),
    }),
    [db],
  );
}

export type BudgetsData = {
  overview: BudgetOverview;
  /** Categories by id, archived ones included, for names and icons. */
  categories: ReadonlyMap<EntityId, Category>;
};

/**
 * Active budgets with what they spent this month (civil month of the device, computed at
 * load time), plus the month's spending without a budget. Reloads on focus.
 */
export function useBudgetOverview() {
  const repositories = useBudgetRepositories();
  const load = useCallback(async (): Promise<BudgetsData> => {
    const period = monthRange(new Date());
    const [budgets, totals, categoryList] = await Promise.all([
      repositories.budgets.list(),
      repositories.transactions.listExpenseTotalsByCategory(period),
      repositories.categories.list({ includeArchived: true }),
    ]);
    const categories = new Map(categoryList.map(c => [c.id, c]));
    const overview = buildBudgetOverview(budgets, totals, period);
    return {
      overview: {
        ...overview,
        budgets: sortBudgetProgress(
          overview.budgets,
          id => categories.get(id)?.name ?? '',
        ),
      },
      categories,
    };
  }, [repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type BudgetFormData = {
  /** Active expense categories a new budget may use. */
  expenseCategories: Category[];
  /** Active budgets (to disable categories that already have one). */
  budgets: Budget[];
  /** Editing: the budget and its category (possibly archived); null when creating. */
  editing: { budget: Budget; category: Category | null } | null;
};

/**
 * What the create/edit form needs. When editing a budget that no longer exists or was
 * archived, the data is null.
 */
export function useBudgetFormData(budgetId: EntityId | undefined) {
  const repositories = useBudgetRepositories();
  const load = useCallback(async (): Promise<BudgetFormData | null> => {
    const [budget, budgets, categoryList] = await Promise.all([
      budgetId ? repositories.budgets.getById(budgetId) : Promise.resolve(null),
      repositories.budgets.list(),
      repositories.categories.list({ includeArchived: true }),
    ]);
    if (budgetId && !budget) {
      return null;
    }
    return {
      expenseCategories: categoryList.filter(
        category => category.kind === 'expense' && category.deletedAt === null,
      ),
      budgets,
      editing: budget
        ? {
            budget,
            category:
              categoryList.find(
                category => category.id === budget.categoryId,
              ) ?? null,
          }
        : null,
    };
  }, [repositories, budgetId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
