import { formatShare } from '../../src/features/dashboard/components/dashboardPresentation';
import {
  summarizeByCurrency,
  type SummaryInput,
} from '../../src/features/dashboard/domain/dashboardSummary';
import { localDatesBetween } from '../../src/shared/lib/dates';

const EMPTY: SummaryInput = {
  accounts: [],
  balances: {},
  dailyTotals: [],
  categoryTotals: [],
  primaryCurrency: 'GTQ',
};

describe('summarizeByCurrency', () => {
  it('has nothing to summarize without accounts or movements', () => {
    expect(summarizeByCurrency(EMPTY)).toEqual([]);
  });

  it('adds the current balances of the accounts, debt included', () => {
    const [summary] = summarizeByCurrency({
      ...EMPTY,
      accounts: [
        { id: 'bank', currency: 'GTQ', initialBalanceMinor: 100000 },
        { id: 'credit', currency: 'GTQ', initialBalanceMinor: 0 },
      ],
      balances: { bank: 450000, credit: -50000 },
    });

    expect(summary.balanceMinor).toBe(400000);
    expect(summary.incomeMinor).toBe(0);
    expect(summary.expenseMinor).toBe(0);
  });

  it('falls back to the initial balance like Cuentas does', () => {
    const [summary] = summarizeByCurrency({
      ...EMPTY,
      accounts: [{ id: 'cash', currency: 'GTQ', initialBalanceMinor: 2500 }],
    });
    expect(summary.balanceMinor).toBe(2500);
  });

  it('builds the month totals and the daily evolution from the SQL sums', () => {
    const [summary] = summarizeByCurrency({
      ...EMPTY,
      dailyTotals: [
        {
          localDate: '2026-10-07',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 999,
        },
        {
          localDate: '2026-10-05',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 45076,
        },
        {
          localDate: '2026-10-05',
          type: 'income',
          currency: 'GTQ',
          totalMinor: 1250000,
        },
      ],
    });

    expect(summary.incomeMinor).toBe(1250000);
    expect(summary.expenseMinor).toBe(46075);
    expect(summary.balanceMinor).toBeNull();
    expect(summary.days).toEqual([
      { localDate: '2026-10-05', incomeMinor: 1250000, expenseMinor: 45076 },
      { localDate: '2026-10-07', incomeMinor: 0, expenseMinor: 999 },
    ]);
  });

  it('orders categories by amount, largest first', () => {
    const [summary] = summarizeByCurrency({
      ...EMPTY,
      categoryTotals: [
        { categoryId: 'a', currency: 'GTQ', totalMinor: 100 },
        { categoryId: 'b', currency: 'GTQ', totalMinor: 900 },
        { categoryId: null, currency: 'GTQ', totalMinor: 500 },
      ],
    });
    expect(summary.categories.map(c => c.categoryId)).toEqual(['b', null, 'a']);
  });

  it('keeps each currency apart, the default one first', () => {
    const summaries = summarizeByCurrency({
      ...EMPTY,
      accounts: [
        { id: 'usd', currency: 'USD', initialBalanceMinor: 1000 },
        { id: 'gtq', currency: 'GTQ', initialBalanceMinor: 5000 },
        { id: 'eur', currency: 'EUR', initialBalanceMinor: 7000 },
      ],
      dailyTotals: [
        {
          localDate: '2026-10-05',
          type: 'expense',
          currency: 'USD',
          totalMinor: 300,
        },
        {
          localDate: '2026-10-05',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 200,
        },
      ],
    });

    expect(summaries.map(s => s.currency)).toEqual(['GTQ', 'EUR', 'USD']);
    expect(summaries.map(s => s.balanceMinor)).toEqual([5000, 7000, 1000]);
    expect(summaries.map(s => s.expenseMinor)).toEqual([200, 0, 300]);
  });
});

describe('dashboard presentation', () => {
  it('formats a category share of the month expenses', () => {
    expect(formatShare(50, 200)).toBe(
      new Intl.NumberFormat('es-GT', { style: 'percent' }).format(0.25),
    );
    expect(formatShare(1, 3)).toContain('33.3');
    expect(formatShare(10, 0)).toBeNull();
  });

  it('lists every civil day of a month, leap years included', () => {
    const october = localDatesBetween('2026-10-01', '2026-10-31');
    expect(october).toHaveLength(31);
    expect(october[0]).toBe('2026-10-01');
    expect(october[30]).toBe('2026-10-31');
    expect(localDatesBetween('2028-02-01', '2028-02-29')).toHaveLength(29);
    expect(localDatesBetween('2026-10-02', '2026-10-01')).toEqual([]);
  });
});
