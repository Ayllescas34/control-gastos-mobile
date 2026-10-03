import type { BudgetInsert, BudgetRow } from '../../../core/db';
import type { Budget } from '../domain/types';

/** DB row → domain entity. */
export function rowToBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. */
export function budgetToInsert(budget: Budget): BudgetInsert {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    amountMinor: budget.amountMinor,
    currency: budget.currency,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    deletedAt: budget.deletedAt,
  };
}
