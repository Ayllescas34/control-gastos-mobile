import { useCallback, useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
import {
  createCategoryRepository,
  type CategoryRepository,
} from '../data/categoryRepository';
import type { Category } from '../domain/types';

/** The categories repository over the app database. Screens never touch SQL. */
export function useCategoryRepository(): CategoryRepository {
  const { db } = useDatabase();
  return useMemo(() => createCategoryRepository(db), [db]);
}

/** Active categories (both kinds), read from SQLite and refreshed on focus. */
export function useCategories() {
  const repository = useCategoryRepository();
  const load = useCallback(() => repository.list(), [repository]);
  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type CategoryWithSiblings = {
  category: Category;
  /** Active categories, for the duplicate-name rule while editing. */
  all: Category[];
} | null;

/** One active category plus the active list; null when it does not exist or is archived. */
export function useCategory(categoryId: EntityId) {
  const repository = useCategoryRepository();
  const load = useCallback(async (): Promise<CategoryWithSiblings> => {
    const [category, all] = await Promise.all([
      repository.getById(categoryId),
      repository.list(),
    ]);
    return category ? { category, all } : null;
  }, [repository, categoryId]);
  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
