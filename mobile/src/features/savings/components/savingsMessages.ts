import { formatMoney } from '../../../shared/lib/money';
import {
  InvalidSavingsGoalError,
  SavingsGoalNotAvailableError,
} from '../domain/savingsGoalErrors';
import type { SavingsGoalProgress } from '../domain/types';
import {
  SAVINGS_GOAL_NAME_MAX_LENGTH,
  type SavingsGoalValidationError,
} from '../domain/validateSavingsGoal';

/** User-facing text for each domain rule. The rules themselves live in the domain. */
export const SAVINGS_GOAL_ERROR_MESSAGES: Record<
  SavingsGoalValidationError,
  string
> = {
  name_required: 'Escribe un nombre para la meta.',
  name_too_long: `El nombre puede tener hasta ${SAVINGS_GOAL_NAME_MAX_LENGTH} caracteres.`,
  target_invalid: 'El monto objetivo debe ser mayor que cero.',
  target_date_invalid: 'Escribe una fecha válida (AAAA-MM-DD).',
  account_required: 'Elige la cuenta donde ahorras.',
  account_not_found: 'La cuenta ya no existe.',
  account_archived: 'La cuenta está archivada. Elige una activa.',
  account_type_invalid:
    'Una tarjeta de crédito no puede tener metas de ahorro. Elige otra cuenta.',
  account_has_goal: 'Esa cuenta ya tiene una meta de ahorro activa.',
};

/** Message for a failed load or save. Domain errors are explained; others stay generic. */
export function describeSavingsError(error: unknown): string {
  if (error instanceof SavingsGoalNotAvailableError) {
    return 'La meta ya no está disponible. Puede que haya sido archivada.';
  }
  if (error instanceof InvalidSavingsGoalError) {
    return error.errors
      .map(code => SAVINGS_GOAL_ERROR_MESSAGES[code])
      .join(' ');
  }
  return 'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.';
}

/**
 * The status in words (never only a color): "En progreso", "Meta alcanzada" or, past the
 * target, "Meta superada por Q 2,500.00".
 */
export function describeSavingsStatus(progress: SavingsGoalProgress): string {
  if (progress.status === 'in_progress') {
    return 'En progreso';
  }
  return progress.remainingMinor < 0
    ? `Meta superada por ${formatMoney(
        -progress.remainingMinor,
        progress.currency,
      )}`
    : 'Meta alcanzada';
}
