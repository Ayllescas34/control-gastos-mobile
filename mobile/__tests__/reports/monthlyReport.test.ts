import { formatShare } from '../../src/features/dashboard/components/dashboardPresentation';
import { formatMovementCount } from '../../src/features/reports/components/reportPresentation';
import {
  buildMonthlyReport,
  type ReportInput,
} from '../../src/features/reports/domain/monthlyReport';
import { monthRangeOf } from '../../src/shared/lib/dates';

const EMPTY: ReportInput = {
  dailyTotals: [],
  categoryTotals: [],
  counts: [],
  primaryCurrency: 'GTQ',
};

describe('buildMonthlyReport', () => {
  it('has nothing to report without income or expenses', () => {
    expect(buildMonthlyReport(EMPTY)).toEqual([]);
  });

  it('adds up the period, its net balance and its counts', () => {
    const [report] = buildMonthlyReport({
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
          type: 'income',
          currency: 'GTQ',
          totalMinor: 500000,
        },
        {
          localDate: '2026-10-05',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 45076,
        },
      ],
      counts: [
        { type: 'expense', currency: 'GTQ', count: 3 },
        { type: 'income', currency: 'GTQ', count: 1 },
      ],
    });

    expect(report).toEqual({
      currency: 'GTQ',
      incomeMinor: 500000,
      expenseMinor: 46075,
      netMinor: 453925,
      incomeCount: 1,
      expenseCount: 3,
      days: [
        { localDate: '2026-10-05', incomeMinor: 500000, expenseMinor: 45076 },
        { localDate: '2026-10-07', incomeMinor: 0, expenseMinor: 999 },
      ],
      categories: [],
    });
    expect(report).not.toHaveProperty('balanceMinor');
  });

  it('reports a negative net balance when expenses exceed income', () => {
    const [report] = buildMonthlyReport({
      ...EMPTY,
      dailyTotals: [
        {
          localDate: '2026-10-01',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 1500,
        },
      ],
      counts: [{ type: 'expense', currency: 'GTQ', count: 1 }],
    });

    expect(report.netMinor).toBe(-1500);
    expect(report.incomeCount).toBe(0);
  });

  it('keeps exact integers with large amounts', () => {
    const large = 900_000_000_000_00;
    const [report] = buildMonthlyReport({
      ...EMPTY,
      dailyTotals: [
        {
          localDate: '2026-10-01',
          type: 'income',
          currency: 'GTQ',
          totalMinor: large,
        },
        {
          localDate: '2026-10-02',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 1,
        },
      ],
    });

    expect(report.netMinor).toBe(large - 1);
    expect(Number.isSafeInteger(report.netMinor)).toBe(true);
  });

  it('keeps one report per currency, the default one first', () => {
    const reports = buildMonthlyReport({
      ...EMPTY,
      dailyTotals: [
        {
          localDate: '2026-10-01',
          type: 'expense',
          currency: 'USD',
          totalMinor: 2000,
        },
        {
          localDate: '2026-10-01',
          type: 'expense',
          currency: 'GTQ',
          totalMinor: 1000,
        },
      ],
      counts: [
        { type: 'expense', currency: 'USD', count: 2 },
        { type: 'expense', currency: 'GTQ', count: 1 },
      ],
    });

    expect(
      reports.map(r => [r.currency, r.expenseMinor, r.expenseCount]),
    ).toEqual([
      ['GTQ', 1000, 1],
      ['USD', 2000, 2],
    ]);
  });

  it('orders categories by amount, largest first', () => {
    const [report] = buildMonthlyReport({
      ...EMPTY,
      categoryTotals: [
        { categoryId: 'food', currency: 'GTQ', totalMinor: 300 },
        { categoryId: null, currency: 'GTQ', totalMinor: 900 },
        { categoryId: 'car', currency: 'GTQ', totalMinor: 500 },
      ],
    });

    expect(report.categories.map(c => c.categoryId)).toEqual([
      null,
      'car',
      'food',
    ]);
  });
});

describe('category shares', () => {
  it('are the part of the expenses of the same currency', () => {
    expect(formatShare(2500, 10000)).toMatch(/^25\s?%$/);
    expect(formatShare(1, 3)).toMatch(/^33[.,]3\s?%$/);
    expect(formatShare(10000, 10000)).toMatch(/^100\s?%$/);
  });

  it('are not shown when there are no expenses (no division by zero)', () => {
    expect(formatShare(0, 0)).toBeNull();
  });
});

describe('formatMovementCount', () => {
  it('names zero, one and many movements', () => {
    expect(formatMovementCount(0)).toBe('Sin movimientos');
    expect(formatMovementCount(1)).toBe('1 movimiento');
    expect(formatMovementCount(12)).toBe('12 movimientos');
  });
});

describe('monthRangeOf', () => {
  it('covers the whole month of a civil date', () => {
    expect(monthRangeOf('2026-10-15')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('moves back and forward across years', () => {
    expect(monthRangeOf('2026-01-01', 1)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(monthRangeOf('2025-12-01', -1)).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it('knows the length of each month, leap years included', () => {
    expect(monthRangeOf('2028-03-01', 1).to).toBe('2028-02-29');
    expect(monthRangeOf('2026-03-31', 1)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
});
