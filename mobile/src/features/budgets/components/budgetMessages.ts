import { formatMoney } from '../../../shared/lib/money';
import {
  BudgetNotAvailableError,
  InvalidBudgetError,
} from '../domain/budgetErrors';
import type { BudgetProgress, BudgetStatus } from '../domain/types';
import type { BudgetValidationError } from '../domain/validateBudget';

/** User-facing text for each domain rule. The rules themselves live in the domain. */
export const BUDGET_ERROR_MESSAGES: Record<BudgetValidationError, string> = {
  category_required: 'Elige una categoría.',
  category_not_found: 'La categoría ya no existe.',
  category_not_expense: 'Elige una categoría de gastos.',
  category_archived: 'La categoría está archivada. Elige una activa.',
  amount_invalid: 'El presupuesto debe ser mayor que cero.',
  currency_invalid: 'La moneda no es válida.',
  budget_duplicate: 'Esa categoría ya tiene un presupuesto.',
};

/** Message for a failed load or save. Domain errors are explained; others stay generic. */
export function describeBudgetsError(error: unknown): string {
  if (error instanceof BudgetNotAvailableError) {
    return 'El presupuesto ya no está disponible. Puede que haya sido archivado.';
  }
  if (error instanceof InvalidBudgetError) {
    return error.errors.map(code => BUDGET_ERROR_MESSAGES[code]).join(' ');
  }
  return 'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.';
}

const STATUS_LABELS: Record<Exclude<BudgetStatus, 'exceeded'>, string> = {
  ok: 'En orden',
  warning: 'Por acercarse al límite',
  reached: 'Límite alcanzado',
};

/** The status in words (never only a color), e.g. "Excedido por Q 250.00". */
export function describeBudgetStatus(progress: BudgetProgress): string {
  return progress.status === 'exceeded'
    ? `Excedido por ${formatMoney(
        -progress.remainingMinor,
        progress.budget.currency,
      )}`
    : STATUS_LABELS[progress.status];
}
