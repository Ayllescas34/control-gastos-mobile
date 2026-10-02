import {
  CategoryNotAvailableError,
  InvalidCategoryError,
} from '../domain/categoryErrors';
import {
  CATEGORY_NAME_MAX_LENGTH,
  type CategoryValidationError,
} from '../domain/validateCategory';

/** User-facing text for each domain rule. The rules themselves live in the domain. */
export const CATEGORY_ERROR_MESSAGES: Record<CategoryValidationError, string> =
  {
    name_required: 'Escribe un nombre para la categoría.',
    name_too_long: `El nombre puede tener hasta ${CATEGORY_NAME_MAX_LENGTH} caracteres.`,
    name_duplicate: 'Ya tienes una categoría con ese nombre.',
    kind_invalid: 'Elige si es de gastos o de ingresos.',
    icon_invalid: 'Elige un icono.',
  };

/** Message for a failed load or save. Domain errors are explained; others stay generic. */
export function describeCategoriesError(error: unknown): string {
  if (error instanceof CategoryNotAvailableError) {
    return 'La categoría ya no está disponible. Puede que haya sido archivada.';
  }
  if (error instanceof InvalidCategoryError) {
    return error.errors.map(code => CATEGORY_ERROR_MESSAGES[code]).join(' ');
  }
  return 'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.';
}
