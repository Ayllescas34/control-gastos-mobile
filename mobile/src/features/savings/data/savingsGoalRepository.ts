import { and, asc, eq } from 'drizzle-orm';
import {
  accounts,
  generateId,
  notDeleted,
  savingsGoals,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import { InvalidSavingsGoalError } from '../domain/savingsGoalErrors';
import type { SavingsGoal } from '../domain/types';
import {
  validateSavingsGoal,
  type SavingsGoalFields,
} from '../domain/validateSavingsGoal';
import { rowToSavingsGoal, savingsGoalToInsert } from './savingsGoalMappers';

export type NewSavingsGoal = Pick<
  SavingsGoal,
  'accountId' | 'name' | 'targetAmountMinor' | 'targetDate'
>;

/**
 * The account is fixed: it defines what the goal measures, so using another account means
 * archiving the goal and creating a new one.
 */
export type SavingsGoalChanges = Partial<
  Pick<SavingsGoal, 'name' | 'targetAmountMinor' | 'targetDate'>
>;

/**
 * Savings goals persistence. Domain rules run first (validateSavingsGoal, with the account
 * and its active goals read here); the schema's CHECKs, FK and partial unique index are the
 * second barrier. Archiving is a soft delete. What a goal has saved is not stored: it is
 * the account's balance, from the transactions repository (docs/savings.md).
 */
export function createSavingsGoalRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(savingsGoals.id, id), notDeleted(savingsGoals));

  async function getById(id: EntityId): Promise<SavingsGoal | null> {
    const row = await db.select().from(savingsGoals).where(isActive(id)).get();
    return row ? rowToSavingsGoal(row) : null;
  }

  async function assertValid(
    goal: SavingsGoalFields,
    currentId?: EntityId,
  ): Promise<void> {
    const [account, existing] = await Promise.all([
      goal.accountId === null
        ? undefined
        : db
            .select({
              id: accounts.id,
              type: accounts.type,
              deletedAt: accounts.deletedAt,
            })
            .from(accounts)
            .where(eq(accounts.id, goal.accountId))
            .get(),
      goal.accountId === null
        ? []
        : db
            .select({
              id: savingsGoals.id,
              accountId: savingsGoals.accountId,
            })
            .from(savingsGoals)
            .where(
              and(
                eq(savingsGoals.accountId, goal.accountId),
                notDeleted(savingsGoals),
              ),
            ),
    ]);
    const result = validateSavingsGoal(goal, {
      account: account ?? null,
      existing,
      currentId,
    });
    if (!result.valid) {
      throw new InvalidSavingsGoalError(result.errors);
    }
  }

  return {
    getById,

    /** Active goals; `includeArchived` also returns archived ones. Oldest first. */
    async list(
      options: { includeArchived?: boolean } = {},
    ): Promise<SavingsGoal[]> {
      const rows = await db
        .select()
        .from(savingsGoals)
        .where(options.includeArchived ? undefined : notDeleted(savingsGoals))
        .orderBy(asc(savingsGoals.createdAt), asc(savingsGoals.id));
      return rows.map(rowToSavingsGoal);
    },

    async create(input: NewSavingsGoal): Promise<SavingsGoal> {
      await assertValid(input);
      const now = nowIsoDateTime();
      const goal: SavingsGoal = {
        id: await generateId(db),
        accountId: input.accountId,
        name: input.name.trim(),
        targetAmountMinor: input.targetAmountMinor,
        targetDate: input.targetDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.insert(savingsGoals).values(savingsGoalToInsert(goal));
      return goal;
    },

    /**
     * Changes name, target and target date after validating the result. Returns the
     * updated goal, or null when it does not exist or is archived.
     */
    async update(
      id: EntityId,
      changes: SavingsGoalChanges,
    ): Promise<SavingsGoal | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      const next = {
        accountId: current.accountId,
        name: (changes.name ?? current.name).trim(),
        targetAmountMinor:
          changes.targetAmountMinor ?? current.targetAmountMinor,
        targetDate:
          changes.targetDate === undefined
            ? current.targetDate
            : changes.targetDate,
      };
      await assertValid(next, id);
      const rows = await db
        .update(savingsGoals)
        .set({
          name: next.name,
          targetAmountMinor: next.targetAmountMinor,
          targetDate: next.targetDate,
          updatedAt: nowIsoDateTime(),
        })
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToSavingsGoal(rows[0]) : null;
    },

    /** Archives the goal (soft delete). Movements are untouched. False when not active. */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(savingsGoals)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: savingsGoals.id });
      return rows.length > 0;
    },
  };
}

export type SavingsGoalRepository = ReturnType<
  typeof createSavingsGoalRepository
>;
