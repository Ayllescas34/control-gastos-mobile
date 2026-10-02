import type { EntityId } from '../../../shared/domain';
import {
  localDateDaysBefore,
  monthRange,
  todayLocalDate,
} from '../../../shared/lib/dates';
import type { TransactionFilters } from '../data/transactionRepository';
import type { TransactionType } from '../domain/types';

export type PeriodFilter = 'all' | 'thisMonth' | 'lastMonth' | 'last30Days';

/** Filters chosen in the Movimientos screen. The search text is kept separately (debounced). */
export type TransactionFilterState = {
  type: TransactionType | 'all';
  period: PeriodFilter;
  accountId: EntityId | null;
  categoryId: EntityId | null;
};

export const DEFAULT_FILTERS: TransactionFilterState = {
  type: 'all',
  period: 'all',
  accountId: null,
  categoryId: null,
};

export const TYPE_FILTER_OPTIONS: readonly {
  value: TransactionFilterState['type'];
  label: string;
}[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
];

export const PERIOD_OPTIONS: readonly { value: PeriodFilter; label: string }[] =
  [
    { value: 'all', label: 'Todo' },
    { value: 'thisMonth', label: 'Este mes' },
    { value: 'lastMonth', label: 'Mes anterior' },
    { value: 'last30Days', label: 'Últimos 30 días' },
  ];

function periodRange(
  period: PeriodFilter,
  now: Date,
): Pick<TransactionFilters, 'from' | 'to'> {
  switch (period) {
    case 'all':
      return {};
    case 'thisMonth':
      return monthRange(now);
    case 'lastMonth':
      return monthRange(now, 1);
    case 'last30Days': {
      const today = todayLocalDate(now);
      return { from: localDateDaysBefore(today, 29), to: today };
    }
  }
}

/**
 * Repository filters for the chosen state. A category never applies to transfers, so it
 * is dropped when only transfers are shown.
 */
export function toRepositoryFilters(
  state: TransactionFilterState,
  search: string,
  now: Date = new Date(),
): TransactionFilters {
  const text = search.trim();
  return {
    ...(state.type !== 'all' && { type: state.type }),
    ...(state.accountId !== null && { accountId: state.accountId }),
    ...(state.categoryId !== null &&
      state.type !== 'transfer' && { categoryId: state.categoryId }),
    ...periodRange(state.period, now),
    ...(text.length > 0 && { search: text }),
  };
}

/** How many filters beyond the type chips are active (shown on the filters toggle). */
export function extraFilterCount(state: TransactionFilterState): number {
  return [
    state.period !== 'all',
    state.accountId !== null,
    state.categoryId !== null && state.type !== 'transfer',
  ].filter(Boolean).length;
}
