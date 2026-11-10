import { appConfig } from '../../../core/config/appConfig';
import type { LocalDate } from '../../../shared/domain';
import {
  localDatesBetween,
  monthRangeOf,
  todayLocalDate,
} from '../../../shared/lib/dates';
import type { CurrencyCode } from '../../../shared/lib/money';
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';
// By module, not the transactions feature index, to keep features free of import cycles.
import type { useTransactionRepositories } from '../../transactions/hooks/transactionHooks';
import {
  balanceSeries,
  foldSlices,
  monthlyTrend,
  spendingByAccount,
  type BalancePoint,
  type ChartSlice,
  type MonthTotals,
} from '../domain/chartData';

/** Months in the trend chart, the shown month last. */
export const TREND_MONTHS = 6;
/** Categories drawn before the rest folds into "Otros" (one hue each, fixed order). */
export const CATEGORY_SLICES = 5;

/** Chart data of one currency. */
export type CurrencyInsights = {
  currency: CurrencyCode;
  trend: MonthTotals[];
  /** Balance at the end of each day of the month, up to today. */
  balance: BalancePoint[];
  byAccount: ChartSlice[];
  byCategory: ChartSlice[];
};

type Repositories = ReturnType<typeof useTransactionRepositories>;

/**
 * Everything the charts of `month` (its first civil day) need, per currency, the default one
 * first. Aggregation happens in SQL; here only integer sums over a few hundred day rows.
 */
export async function loadInsights(
  repositories: Repositories,
  references: ReferenceLookup,
  month: LocalDate,
  now: Date = new Date(),
): Promise<CurrencyInsights[]> {
  const today = todayLocalDate(now);
  const period = monthRangeOf(month);
  const months = Array.from({ length: TREND_MONTHS }, (_, index) =>
    monthRangeOf(month, TREND_MONTHS - 1 - index),
  );
  const throughToday = today > period.to ? today : period.to;
  const [dailyTotals, accounts, balances, byAccount, byCategory] =
    await Promise.all([
      repositories.transactions.listDailyTotals({
        from: months[0].from,
        to: throughToday,
      }),
      repositories.accounts.list(),
      repositories.transactions.listAccountBalances(),
      repositories.transactions.listExpenseTotalsByAccount(period),
      repositories.transactions.listExpenseTotalsByCategory(period),
    ]);

  const currencies = [
    ...new Set([
      ...accounts.map(account => account.currency),
      ...dailyTotals.map(day => day.currency),
    ]),
  ].sort((a, b) =>
    a === appConfig.defaultCurrency ? -1 : b === appConfig.defaultCurrency ? 1 : a.localeCompare(b),
  );
  const dates = localDatesBetween(period.from, period.to);

  return currencies.map(currency => {
    const current = accounts
      .filter(account => account.currency === currency)
      .reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
    return {
      currency,
      trend: monthlyTrend(dailyTotals, months, currency),
      balance: balanceSeries(dailyTotals, dates, current, currency, today),
      byAccount: spendingByAccount(byAccount, currency, {
        account: id => references.account(id)?.name,
        card: id => references.card(id),
      }),
      byCategory: foldSlices(
        byCategory
          .filter(row => row.currency === currency)
          .map(row => ({
            key: row.categoryId ?? 'none',
            label:
              row.categoryId === null
                ? 'Sin categoría'
                : references.category(row.categoryId)?.name ?? 'Categoría',
            valueMinor: row.totalMinor,
          })),
        CATEGORY_SLICES,
      ),
    };
  });
}
