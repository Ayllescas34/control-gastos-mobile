import { and, asc, eq } from 'drizzle-orm';
import {
  budgets,
  categories,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import { InvalidBudgetError } from '../domain/budgetErrors';
import type { Budget } from '../domain/types';
import { validateBudget, type BudgetFields } from '../domain/validateBudget';
import { budgetToInsert, rowToBudget } from './budgetMappers';

export type NewBudget = Pick<Budget, 'categoryId' | 'amountMinor' | 'currency'>;

/**
 * Only the limit is editable: category and currency define which expenses the budget
 * counts, so changing them means archiving it and creating another.
 */
export type BudgetChanges = Partial<Pick<Budget, 'amountMinor'>>;

/**
 * Budgets persistence. Domain rules run first (validateBudget, with the category and the
 * active budgets read here); the schema's CHECKs, FK and partial unique index are the
 * second barrier. Archiving is a soft delete. What a budget has spent is not stored: it
 * comes from the transactions repository (docs/budgets.md).
 */
export function createBudgetRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(budgets.id, id), notDeleted(budgets));

  async function getById(id: EntityId): Promise<Budget | null> {
    const row = await db.select().from(budgets).where(isActive(id)).get();
    return row ? rowToBudget(row) : null;
  }

  async function assertValid(
    budget: BudgetFields,
    currentId?: EntityId,
  ): Promise<void> {
    const [category, existing] = await Promise.all([
      budget.categoryId === null
        ? undefined
        : db
            .select({
              id: categories.id,
              kind: categories.kind,
              deletedAt: categories.deletedAt,
            })
            .from(categories)
            .where(eq(categories.id, budget.categoryId))
            .get(),
      budget.categoryId === null
        ? []
        : db
            .select({
              id: budgets.id,
              categoryId: budgets.categoryId,
              currency: budgets.currency,
            })
            .from(budgets)
            .where(
              and(
                eq(budgets.categoryId, budget.categoryId),
                notDeleted(budgets),
              ),
            ),
    ]);
    const result = validateBudget(budget, {
      category: category ?? null,
      existing,
      currentId,
    });
    if (!result.valid) {
      throw new InvalidBudgetError(result.errors);
    }
  }

  return {
    getById,

    /** Active budgets; `includeArchived` also returns archived ones. Oldest first. */
    async list(options: { includeArchived?: boolean } = {}): Promise<Budget[]> {
      const rows = await db
        .select()
        .from(budgets)
        .where(options.includeArchived ? undefined : notDeleted(budgets))
        .orderBy(asc(budgets.createdAt), asc(budgets.id));
      return rows.map(rowToBudget);
    },

    async create(input: NewBudget): Promise<Budget> {
      await assertValid(input);
      const now = nowIsoDateTime();
      const budget: Budget = {
        id: await generateId(db),
        categoryId: input.categoryId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.insert(budgets).values(budgetToInsert(budget));
      return budget;
    },

    /**
     * Changes the limit after validating the result (the category may have been archived
     * since). Returns the updated budget, or null when it does not exist or is archived.
     */
    async update(id: EntityId, changes: BudgetChanges): Promise<Budget | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      const amountMinor = changes.amountMinor ?? current.amountMinor;
      await assertValid({ ...current, amountMinor }, id);
      const rows = await db
        .update(budgets)
        .set({ amountMinor, updatedAt: nowIsoDateTime() })
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToBudget(rows[0]) : null;
    },

    /** Archives the budget (soft delete). Movements are untouched. False when not active. */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(budgets)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: budgets.id });
      return rows.length > 0;
    },
  };
}

export type BudgetRepository = ReturnType<typeof createBudgetRepository>;
