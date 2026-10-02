import type { CategoryInsert, CategoryRow } from '../../../core/db';
import {
  CATEGORY_ICONS,
  type Category,
  type CategoryIcon,
} from '../domain/types';

/** The DB stores any icon name (no CHECK); one the app no longer offers falls back. */
function toCategoryIcon(icon: string): CategoryIcon {
  return (CATEGORY_ICONS as readonly string[]).includes(icon)
    ? (icon as CategoryIcon)
    : 'other';
}

/** DB row → domain entity. */
export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    icon: toCategoryIcon(row.icon),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. */
export function categoryToInsert(category: Category): CategoryInsert {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt,
  };
}
