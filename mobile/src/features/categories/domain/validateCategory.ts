import type { EntityId } from '../../../shared/domain';
import { CATEGORY_ICONS, CATEGORY_KINDS, type Category } from './types';

export const CATEGORY_NAME_MAX_LENGTH = 40;

export type CategoryValidationError =
  | 'name_required'
  | 'name_too_long'
  | 'name_duplicate'
  | 'kind_invalid'
  | 'icon_invalid';

export type CategoryValidationResult = {
  valid: boolean;
  errors: CategoryValidationError[];
};

/** The fields a category's rules depend on. Kind and icon are widened: input is untrusted. */
export type CategoryFields = Pick<Category, 'name'> & {
  kind: string | null;
  icon: string | null;
};

/** Other categories the rules compare against (the active ones). */
export type CategoryValidationContext = {
  existing: readonly Pick<Category, 'id' | 'name' | 'kind'>[];
  /** When editing, the category itself, which may keep its own name. */
  currentId?: EntityId;
};

/**
 * Comparison key for names: case, accents and surrounding or repeated spaces do not make
 * a different category ("Café", " cafe " and "CAFÉ" are the same name).
 */
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es');
}

function isOneOf(value: string | null, values: readonly string[]): boolean {
  return value !== null && values.includes(value);
}

/**
 * Pure domain validation: no I/O. Returns every broken rule. A name is unique among the
 * active categories of the same kind ("Otros" may exist once for expenses and once for
 * income).
 */
export function validateCategory(
  category: CategoryFields,
  context: CategoryValidationContext,
): CategoryValidationResult {
  const errors: CategoryValidationError[] = [];

  const name = category.name.trim();
  if (name.length === 0) {
    errors.push('name_required');
  } else if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    errors.push('name_too_long');
  }

  const kindValid = isOneOf(category.kind, CATEGORY_KINDS);
  if (!kindValid) {
    errors.push('kind_invalid');
  }
  if (!isOneOf(category.icon, CATEGORY_ICONS)) {
    errors.push('icon_invalid');
  }

  if (name.length > 0 && kindValid) {
    const key = normalizeCategoryName(name);
    const duplicate = context.existing.some(
      other =>
        other.id !== context.currentId &&
        other.kind === category.kind &&
        normalizeCategoryName(other.name) === key,
    );
    if (duplicate) {
      errors.push('name_duplicate');
    }
  }

  return { valid: errors.length === 0, errors };
}
