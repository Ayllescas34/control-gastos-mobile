import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
// By module, not the feature index, to keep features free of import cycles.
import {
  summarizeByCurrency,
  type CurrencySummary,
  type SummaryInput,
} from '../../dashboard/domain/dashboardSummary';

/**
 * What a report shows for one currency in the period. The totals, days and categories are
 * the dashboard's own aggregation (summarizeByCurrency), so both screens agree; balances
 * are left out because a report describes a period, not the accounts' current state.
 */
export type CurrencyReport = Omit<CurrencySummary, 'balanceMinor'> & {
  /** incomeMinor - expenseMinor: negative when the period spent more than it earned. */
  netMinor: MinorUnits;
  incomeCount: number;
  expenseCount: number;
};

export type ReportInput = Pick<
  SummaryInput,
  'dailyTotals' | 'categoryTotals' | 'primaryCurrency'
> & {
  /** Income/expense movements per currency, over the same rows as the totals. */
  counts: {
    type: 'income' | 'expense';
    currency: CurrencyCode;
    count: number;
  }[];
};

/**
 * One report per currency with income or expenses in the period, the default currency
 * first. Amounts are never added across currencies; only integers are summed.
 */
export function buildMonthlyReport(input: ReportInput): CurrencyReport[] {
  const countOf = (currency: CurrencyCode, type: 'income' | 'expense') =>
    input.counts
      .filter(count => count.currency === currency && count.type === type)
      .reduce((sum, count) => sum + count.count, 0);

  return summarizeByCurrency({
    accounts: [],
    balances: {},
    dailyTotals: input.dailyTotals,
    categoryTotals: input.categoryTotals,
    primaryCurrency: input.primaryCurrency,
  }).map(summary => ({
    currency: summary.currency,
    incomeMinor: summary.incomeMinor,
    expenseMinor: summary.expenseMinor,
    days: summary.days,
    categories: summary.categories,
    netMinor: summary.incomeMinor - summary.expenseMinor,
    incomeCount: countOf(summary.currency, 'income'),
    expenseCount: countOf(summary.currency, 'expense'),
  }));
}
