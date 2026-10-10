import { appConfig } from '../../../core/config/appConfig';
import type { IconName } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import type { ColorName } from '../../../shared/theme';
import type { SavingsGoalProgress, SavingsGoalStatus } from '../domain/types';

const percentNumber = new Intl.NumberFormat(appConfig.locale, {
  maximumFractionDigits: 1,
});

/**
 * Share of the target already saved, e.g. 125 when surpassed (never capped above) and 0
 * when the balance is negative. Presentation only: the division builds display text and
 * never feeds back into amounts.
 */
export function percentSaved(progress: SavingsGoalProgress): number {
  return Math.max(
    0,
    (progress.savedMinor / progress.goal.targetAmountMinor) * 100,
  );
}

/** "45%" for the screen. */
export function formatPercentSaved(progress: SavingsGoalProgress): string {
  return `${percentNumber.format(percentSaved(progress))}%`;
}

/** "45 por ciento", for screen readers. */
export function spokenPercentSaved(progress: SavingsGoalProgress): string {
  return `${percentNumber.format(percentSaved(progress))} por ciento`;
}

/**
 * "Fecha objetivo: 15 dic 2026", with "(pasada)" once `today` is later. Informative only:
 * a past date changes no status.
 */
export function describeTargetDate(targetDate: string, today: string): string {
  const label = `Fecha objetivo: ${formatLocalDate(targetDate)}`;
  return targetDate < today ? `${label} (pasada)` : label;
}

/** Color and icon of each status. Words always accompany them (describeSavingsStatus). */
export const SAVINGS_STATUS_VISUALS: Record<
  SavingsGoalStatus,
  { color: ColorName; icon: IconName }
> = {
  in_progress: { color: 'primary', icon: 'wallet' },
  reached: { color: 'success', icon: 'success' },
};
