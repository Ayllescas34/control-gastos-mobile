import { and, asc, eq, type SQL } from 'drizzle-orm';
import {
  categories,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import { InvalidCategoryError } from '../domain/categoryErrors';
import type { Category, CategoryKind } from '../domain/types';
import {
  validateCategory,
  type CategoryFields,
} from '../domain/validateCategory';
import { categoryToInsert, rowToCategory } from './categoryMappers';

export type NewCategory = Pick<Category, 'name' | 'kind' | 'icon'>;

/**
 * The kind is not editable: transactions already classified by the category must keep a
 * category of their own type.
 */
export type CategoryChanges = Partial<Pick<Category, 'name' | 'icon'>>;

export type CategoryListOptions = {
  kind?: CategoryKind;
  /** Also archived ones, e.g. to show the category of a past transaction. */
  includeArchived?: boolean;
};

/**
 * Categories persistence. Domain rules run first (validateCategory, including duplicate
 * names among active categories); the schema's CHECKs and partial unique index are the
 * second barrier. Archiving is a soft delete: transactions keep their category_id.
 */
export function createCategoryRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(categories.id, id), notDeleted(categories));

  async function list(options: CategoryListOptions = {}): Promise<Category[]> {
    const conditions: SQL[] = [];
    if (!options.includeArchived) {
      conditions.push(notDeleted(categories));
    }
    if (options.kind) {
      conditions.push(eq(categories.kind, options.kind));
    }
    const rows = await db
      .select()
      .from(categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(categories.kind), asc(categories.name));
    return rows.map(rowToCategory);
  }

  async function assertValid(
    category: CategoryFields,
    currentId?: EntityId,
  ): Promise<void> {
    const result = validateCategory(category, {
      existing: await list(),
      currentId,
    });
    if (!result.valid) {
      throw new InvalidCategoryError(result.errors);
    }
  }

  async function getById(id: EntityId): Promise<Category | null> {
    const row = await db.select().from(categories).where(isActive(id)).get();
    return row ? rowToCategory(row) : null;
  }

  return {
    list,
    getById,

    async create(input: NewCategory): Promise<Category> {
      await assertValid(input);
      const now = nowIsoDateTime();
      const category: Category = {
        id: await generateId(db),
        name: input.name,
        kind: input.kind,
        icon: input.icon,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.insert(categories).values(categoryToInsert(category));
      return category;
    },

    /**
     * Validates the resulting category before writing. Returns the updated category, or
     * null when it does not exist or is archived.
     */
    async update(
      id: EntityId,
      changes: CategoryChanges,
    ): Promise<Category | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      await assertValid(
        {
          name: changes.name ?? current.name,
          kind: current.kind,
          icon: changes.icon ?? current.icon,
        },
        id,
      );
      const rows = await db
        .update(categories)
        .set({
          name: changes.name,
          icon: changes.icon,
          updatedAt: nowIsoDateTime(),
        })
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToCategory(rows[0]) : null;
    },

    /**
     * Archives the category (soft delete). Its transactions are untouched and keep showing
     * it. Returns false when it was not active.
     */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(categories)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: categories.id });
      return rows.length > 0;
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
