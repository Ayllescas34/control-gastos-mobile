import type { SavingsGoalInsert, SavingsGoalRow } from '../../../core/db';
import type { SavingsGoal } from '../domain/types';

/** DB row → domain entity. */
export function rowToSavingsGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    targetAmountMinor: row.targetAmountMinor,
    targetDate: row.targetDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. */
export function savingsGoalToInsert(goal: SavingsGoal): SavingsGoalInsert {
  return {
    id: goal.id,
    accountId: goal.accountId,
    name: goal.name,
    targetAmountMinor: goal.targetAmountMinor,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    deletedAt: goal.deletedAt,
  };
}
