import { useCallback, useState } from 'react';
import { appConfig } from '../../../core/config/appConfig';
import type { LocalDate } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
import { monthRange, monthRangeOf } from '../../../shared/lib/dates';
// By module, not the transactions feature index, to keep features free of import cycles.
import type { LocalDateRange } from '../../transactions/data/transactionRepository';
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';
import {
  loadReferences,
  useTransactionRepositories,
} from '../../transactions/hooks/transactionHooks';
import {
  buildMonthlyReport,
  type CurrencyReport,
} from '../domain/monthlyReport';

export type MonthlyReportData = {
  /** The month these figures belong to. */
  period: LocalDateRange;
  /** One per currency with income or expenses, the default currency first. */
  reports: CurrencyReport[];
  /** Names and icons of categories, archived ones included. */
  references: ReferenceLookup;
};

/** First civil day of the device's current month. */
const currentMonth = (): LocalDate => monthRange(new Date()).from;

/**
 * The month a report shows, as its first civil day. Starts at the current month and never
 * moves past it: future months have no movements to report.
 */
export function useReportMonth() {
  const [month, setMonth] = useState<LocalDate>(currentMonth);
  const isCurrent = month >= currentMonth();

  return {
    month,
    isCurrent,
    previous: useCallback(() => setMonth(m => monthRangeOf(m, 1).from), []),
    next: useCallback(
      () =>
        setMonth(m => {
          const following = monthRangeOf(m, -1).from;
          return following > currentMonth() ? m : following;
        }),
      [],
    ),
    toCurrent: useCallback(() => setMonth(currentMonth()), []),
  };
}

/**
 * Income, expenses, categories and daily activity of the month starting on `month`, read
 * from SQLite with the dashboard's aggregate queries (summed in SQL, never the whole
 * history in JavaScript). Reloads on focus and whenever the month changes.
 */
export function useMonthlyReport(month: LocalDate) {
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<MonthlyReportData> => {
    const period = monthRangeOf(month);
    const [dailyTotals, categoryTotals, counts, references] = await Promise.all(
      [
        repositories.transactions.listDailyTotals(period),
        repositories.transactions.listExpenseTotalsByCategory(period),
        repositories.transactions.listMovementCounts(period),
        loadReferences(repositories),
      ],
    );
    return {
      period,
      reports: buildMonthlyReport({
        dailyTotals,
        categoryTotals,
        counts,
        primaryCurrency: appConfig.defaultCurrency,
      }),
      references,
    };
  }, [repositories, month]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
