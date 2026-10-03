import type { EntityId, LocalDate } from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

/** Income and expense of one civil day (only days with movements exist). */
export type DayEvolution = {
  localDate: LocalDate;
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
};

/** Expenses of one category in the period; null categoryId: uncategorized. */
export type CategorySpending = {
  categoryId: EntityId | null;
  totalMinor: MinorUnits;
};

/**
 * Everything the dashboard shows for one currency. Amounts of different currencies are
 * never added together: there is no exchange rate in the domain.
 */
export type CurrencySummary = {
  currency: CurrencyCode;
  /** Sum of the current balances of the active accounts in this currency; null when none. */
  balanceMinor: MinorUnits | null;
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
  /** Days of the period with income or expense, oldest first. */
  days: DayEvolution[];
  /** Largest first. */
  categories: CategorySpending[];
};

export type SummaryInput = {
  /** Active accounts. */
  accounts: {
    id: EntityId;
    currency: CurrencyCode;
    initialBalanceMinor: MinorUnits;
  }[];
  /** Current balance of each active account, as Cuentas shows it. */
  balances: Record<EntityId, MinorUnits>;
  /** Income/expense totals per day and currency (transfers already excluded). */
  dailyTotals: {
    localDate: LocalDate;
    type: 'income' | 'expense';
    currency: CurrencyCode;
    totalMinor: MinorUnits;
  }[];
  /** Expense totals per category and currency, largest first. */
  categoryTotals: {
    categoryId: EntityId | null;
    currency: CurrencyCode;
    totalMinor: MinorUnits;
  }[];
  /** Shown first (the app's default currency). */
  primaryCurrency: CurrencyCode;
};

/**
 * Groups already-aggregated figures by currency. Only integer additions happen here: the
 * balances come from the accounts' derived balance and the period totals from SQL sums.
 */
export function summarizeByCurrency(input: SummaryInput): CurrencySummary[] {
  const summaries = new Map<CurrencyCode, CurrencySummary>();
  const summaryOf = (currency: CurrencyCode): CurrencySummary => {
    let summary = summaries.get(currency);
    if (!summary) {
      summary = {
        currency,
        balanceMinor: null,
        incomeMinor: 0,
        expenseMinor: 0,
        days: [],
        categories: [],
      };
      summaries.set(currency, summary);
    }
    return summary;
  };

  for (const account of input.accounts) {
    const summary = summaryOf(account.currency);
    summary.balanceMinor =
      (summary.balanceMinor ?? 0) +
      (input.balances[account.id] ?? account.initialBalanceMinor);
  }

  const days = new Map<string, DayEvolution>();
  for (const total of input.dailyTotals) {
    const summary = summaryOf(total.currency);
    const key = `${total.currency} ${total.localDate}`;
    let day = days.get(key);
    if (!day) {
      day = { localDate: total.localDate, incomeMinor: 0, expenseMinor: 0 };
      days.set(key, day);
      summary.days.push(day);
    }
    if (total.type === 'income') {
      day.incomeMinor += total.totalMinor;
      summary.incomeMinor += total.totalMinor;
    } else {
      day.expenseMinor += total.totalMinor;
      summary.expenseMinor += total.totalMinor;
    }
  }

  for (const total of input.categoryTotals) {
    summaryOf(total.currency).categories.push({
      categoryId: total.categoryId,
      totalMinor: total.totalMinor,
    });
  }

  for (const summary of summaries.values()) {
    summary.days.sort((a, b) => a.localDate.localeCompare(b.localDate));
    summary.categories.sort((a, b) => b.totalMinor - a.totalMinor);
  }

  return [...summaries.values()].sort((a, b) => {
    if (a.currency === input.primaryCurrency) {
      return -1;
    }
    if (b.currency === input.primaryCurrency) {
      return 1;
    }
    return a.currency.localeCompare(b.currency);
  });
}
