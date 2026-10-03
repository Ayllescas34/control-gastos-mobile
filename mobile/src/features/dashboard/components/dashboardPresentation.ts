import { appConfig } from '../../../core/config/appConfig';
import type { EntityId, LocalDate } from '../../../shared/domain';
import type { IconName } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import type { MinorUnits } from '../../../shared/lib/money';
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';

const percentFormat = new Intl.NumberFormat(appConfig.locale, {
  style: 'percent',
  maximumFractionDigits: 1,
});

/**
 * Share of `partMinor` in `totalMinor`, e.g. "45.3 %". Presentation only: the division
 * builds display text and never feeds back into amounts. Null when there is no total.
 */
export function formatShare(
  partMinor: MinorUnits,
  totalMinor: MinorUnits,
): string | null {
  return totalMinor > 0 ? percentFormat.format(partMinor / totalMinor) : null;
}

/** "Octubre 2026" for the month that starts on `from`. */
export function formatPeriodLabel(from: LocalDate): string {
  const label = formatLocalDate(from, 'MMMM yyyy');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type CategoryRowView = {
  name: string;
  icon: IconName;
  archived: boolean;
};

/** Name and icon of an expense category; uncategorized expenses get a neutral row. */
export function describeCategory(
  categoryId: EntityId | null,
  references: ReferenceLookup,
): CategoryRowView {
  const category = references.category(categoryId);
  if (!category) {
    return { name: 'Sin categoría', icon: 'category', archived: false };
  }
  return {
    name: category.name,
    icon: category.icon,
    archived: category.deletedAt !== null,
  };
}
