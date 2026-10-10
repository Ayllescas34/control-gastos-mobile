import { useCallback, useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
// Repositories by module (not the feature index) to keep features free of import cycles.
import { createAccountRepository } from '../../accounts/data/accountRepository';
import type { Account } from '../../accounts/domain/types';
import { createTransactionRepository } from '../../transactions/data/transactionRepository';
import { createSavingsGoalRepository } from '../data/savingsGoalRepository';
import {
  buildSavingsOverview,
  sortSavingsGoals,
} from '../domain/savingsGoalProgress';
import type { SavingsGoal, SavingsOverview } from '../domain/types';

/** Every repository the savings screens read from. Screens never touch SQL. */
export function useSavingsRepositories() {
  const { db } = useDatabase();
  return useMemo(
    () => ({
      goals: createSavingsGoalRepository(db),
      accounts: createAccountRepository(db),
      /** What a goal has saved is its account's balance, derived in SQL. */
      transactions: createTransactionRepository(db),
    }),
    [db],
  );
}

export type SavingsData = {
  overview: SavingsOverview;
  /** Accounts by id, archived ones included, for names. */
  accounts: ReadonlyMap<EntityId, Account>;
};

/**
 * Active goals with what their accounts hold now: one query for every balance, never one
 * per goal or per movement. Reloads on focus (after creating, editing, archiving or
 * registering movements).
 */
export function useSavingsOverview() {
  const repositories = useSavingsRepositories();
  const load = useCallback(async (): Promise<SavingsData> => {
    const [goals, balances, accountList] = await Promise.all([
      repositories.goals.list(),
      repositories.transactions.listAccountBalances(),
      repositories.accounts.list({ includeArchived: true }),
    ]);
    const overview = buildSavingsOverview(goals, balances, accountList);
    return {
      overview: { goals: sortSavingsGoals(overview.goals) },
      accounts: new Map(accountList.map(a => [a.id, a])),
    };
  }, [repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type SavingsGoalFormData = {
  /** Active accounts a new goal may use (credit cards excluded). */
  accounts: Account[];
  /** Active goals (to disable accounts that already have one). */
  goals: SavingsGoal[];
  /** Editing: the goal and its account; null when creating. */
  editing: { goal: SavingsGoal; account: Account | null } | null;
};

/**
 * What the create/edit form needs. When editing a goal that no longer exists or was
 * archived, the data is null.
 */
export function useSavingsGoalFormData(goalId: EntityId | undefined) {
  const repositories = useSavingsRepositories();
  const load = useCallback(async (): Promise<SavingsGoalFormData | null> => {
    const [goal, goals, accountList] = await Promise.all([
      goalId ? repositories.goals.getById(goalId) : Promise.resolve(null),
      repositories.goals.list(),
      repositories.accounts.list({ includeArchived: true }),
    ]);
    if (goalId && !goal) {
      return null;
    }
    return {
      accounts: accountList.filter(
        account => account.deletedAt === null && account.type !== 'credit_card',
      ),
      goals,
      editing: goal
        ? {
            goal,
            account: accountList.find(a => a.id === goal.accountId) ?? null,
          }
        : null,
    };
  }, [repositories, goalId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
