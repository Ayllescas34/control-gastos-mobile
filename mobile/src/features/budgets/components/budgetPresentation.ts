import { appConfig } from '../../../core/config/appConfig';
import type { IconName } from '../../../shared/icons';
import type { ColorName } from '../../../shared/theme';
import type { BudgetProgress, BudgetStatus } from '../domain/types';

const percentNumber = new Intl.NumberFormat(appConfig.locale, {
  maximumFractionDigits: 1,
});

/**
 * Share of the limit already spent, e.g. 125 when exceeded (never capped at 100).
 * Presentation only: the division builds display text and never feeds back into amounts.
 */
export function percentUsed(progress: BudgetProgress): number {
  return (progress.spentMinor / progress.budget.amountMinor) * 100;
}

/** "62.5%" for the screen. */
export function formatPercentUsed(progress: BudgetProgress): string {
  return `${percentNumber.format(percentUsed(progress))}%`;
}

/** "62.5 por ciento", for screen readers. */
export function spokenPercentUsed(progress: BudgetProgress): string {
  return `${percentNumber.format(percentUsed(progress))} por ciento`;
}

/** Color and icon of each status. Words always accompany them (describeBudgetStatus). */
export const BUDGET_STATUS_VISUALS: Record<
  BudgetStatus,
  { color: ColorName; icon: IconName }
> = {
  ok: { color: 'success', icon: 'success' },
  warning: { color: 'warning', icon: 'warning' },
  reached: { color: 'warning', icon: 'warning' },
  exceeded: { color: 'error', icon: 'error' },
};
