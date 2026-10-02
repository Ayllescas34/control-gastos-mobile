import type { NewCategory } from '../data/categoryRepository';
import type { Category, CategoryIcon, CategoryKind } from '../domain/types';
import {
  validateCategory,
  type CategoryValidationContext,
  type CategoryValidationError,
} from '../domain/validateCategory';
import { CATEGORY_ERROR_MESSAGES } from './categoryMessages';

export type CategoryFormValues = {
  name: string;
  kind: CategoryKind | null;
  icon: CategoryIcon | null;
};

export type CategoryFormField = keyof CategoryFormValues;
export type CategoryFormErrors = Partial<Record<CategoryFormField, string>>;

export type CategoryFormResult =
  | { ok: true; input: NewCategory }
  | { ok: false; errors: CategoryFormErrors };

const FIELD_OF_ERROR: Record<CategoryValidationError, CategoryFormField> = {
  name_required: 'name',
  name_too_long: 'name',
  name_duplicate: 'name',
  kind_invalid: 'kind',
  icon_invalid: 'icon',
};

export function categoryFieldOfError(
  code: CategoryValidationError,
): CategoryFormField {
  return FIELD_OF_ERROR[code];
}

export function emptyCategoryForm(
  kind: CategoryKind | null,
): CategoryFormValues {
  return { name: '', kind, icon: null };
}

export function categoryToFormValues(category: Category): CategoryFormValues {
  return { name: category.name, kind: category.kind, icon: category.icon };
}

/**
 * Turns form values into a domain input (trimmed name) and runs validateCategory against
 * the categories shown to the user. The repository validates again before writing.
 */
export function parseCategoryForm(
  values: CategoryFormValues,
  context: CategoryValidationContext,
): CategoryFormResult {
  const name = values.name.trim();
  const errors: CategoryFormErrors = {};
  for (const code of validateCategory(
    { name, kind: values.kind, icon: values.icon },
    context,
  ).errors) {
    errors[FIELD_OF_ERROR[code]] ??= CATEGORY_ERROR_MESSAGES[code];
  }

  if (
    Object.keys(errors).length > 0 ||
    values.kind === null ||
    values.icon === null
  ) {
    return { ok: false, errors };
  }
  return { ok: true, input: { name, kind: values.kind, icon: values.icon } };
}
