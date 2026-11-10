import type { EntityId, LocalDate } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

/** Income and expense of one month (its first civil day identifies it). */
export type MonthTotals = {
  month: LocalDate;
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
};

/** Total balance at the end of one civil day. */
export type BalancePoint = {
  localDate: LocalDate;
  balanceMinor: MinorUnits;
};

/** A share of a whole, ready to draw (donut slice, bar). */
export type ChartSlice = {
  key: string;
  label: string;
  valueMinor: MinorUnits;
};

type DailyTotal = {
  localDate: LocalDate;
  type: 'income' | 'expense';
  currency: CurrencyCode;
  totalMinor: MinorUnits;
};

/**
 * Income and expense per month for `months` (oldest first), from daily totals. Months without
 * movements are zeros, never left out, so the bars keep their places.
 */
export function monthlyTrend(
  dailyTotals: readonly DailyTotal[],
  months: readonly { from: LocalDate; to: LocalDate }[],
  currency: CurrencyCode,
): MonthTotals[] {
  return months.map(month => {
    let incomeMinor = 0;
    let expenseMinor = 0;
    for (const day of dailyTotals) {
      if (
        day.currency === currency &&
        day.localDate >= month.from &&
        day.localDate <= month.to
      ) {
        if (day.type === 'income') {
          incomeMinor += day.totalMinor;
        } else {
          expenseMinor += day.totalMinor;
        }
      }
    }
    return { month: month.from, incomeMinor, expenseMinor };
  });
}

/**
 * Total balance at the end of every day of `dates` (ascending, none after `today`), walking
 * back from today's balance: the balance at the end of a day is the next day's minus that
 * next day's income plus its expenses. Transfers between own accounts do not change the total.
 * `dailyTotals` must cover from the first date through today.
 */
export function balanceSeries(
  dailyTotals: readonly DailyTotal[],
  dates: readonly LocalDate[],
  currentBalanceMinor: MinorUnits,
  currency: CurrencyCode,
  today: LocalDate,
): BalancePoint[] {
  const shown = dates.filter(date => date <= today);
  if (shown.length === 0) {
    return [];
  }
  const netAfter = (date: LocalDate) =>
    dailyTotals.reduce(
      (sum, day) =>
        day.currency === currency && day.localDate > date && day.localDate <= today
          ? sum + (day.type === 'income' ? day.totalMinor : -day.totalMinor)
          : sum,
      0,
    );
  return shown.map(localDate => ({
    localDate,
    balanceMinor: currentBalanceMinor - netAfter(localDate),
  }));
}

/** The largest `limit` shares, the rest folded into one "Otros" slice. */
export function foldSlices(
  slices: readonly ChartSlice[],
  limit: number,
): ChartSlice[] {
  const sorted = [...slices]
    .filter(slice => slice.valueMinor > 0)
    .sort((a, b) => b.valueMinor - a.valueMinor);
  if (sorted.length <= limit + 1) {
    return sorted;
  }
  const rest = sorted
    .slice(limit)
    .reduce((sum, slice) => sum + slice.valueMinor, 0);
  return [
    ...sorted.slice(0, limit),
    { key: 'other', label: 'Otros', valueMinor: rest },
  ];
}

/** Expense per account and card, labelled like the wallet ("Visa •••• 4242", "BI Monetaria"). */
export function spendingByAccount(
  rows: readonly {
    accountId: EntityId;
    cardId: EntityId | null;
    currency: CurrencyCode;
    totalMinor: MinorUnits;
  }[],
  currency: CurrencyCode,
  names: {
    account: (id: EntityId) => string | undefined;
    card: (id: EntityId) => { alias: string; last4: string } | undefined;
  },
): ChartSlice[] {
  return rows
    .filter(row => row.currency === currency && row.totalMinor > 0)
    .map(row => {
      const card = row.cardId === null ? undefined : names.card(row.cardId);
      const account = names.account(row.accountId) ?? 'Cuenta';
      return {
        key: `${row.accountId}:${row.cardId ?? ''}`,
        label: card ? `${card.alias} •••• ${card.last4}` : account,
        valueMinor: row.totalMinor,
      };
    })
    .sort((a, b) => b.valueMinor - a.valueMinor);
}
