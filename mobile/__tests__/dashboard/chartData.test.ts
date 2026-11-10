import {
  balanceSeries,
  foldSlices,
  monthlyTrend,
  spendingByAccount,
} from '../../src/features/dashboard/domain/chartData';

const day = (
  localDate: string,
  type: 'income' | 'expense',
  totalMinor: number,
  currency = 'GTQ',
) => ({ localDate, type, currency, totalMinor });

describe('monthlyTrend', () => {
  it('sums per month and keeps empty months as zeros, one currency only', () => {
    const months = [
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-10-31' },
      { from: '2026-11-01', to: '2026-11-30' },
    ];
    expect(
      monthlyTrend(
        [
          day('2026-09-05', 'income', 500000),
          day('2026-09-20', 'expense', 12000),
          day('2026-09-21', 'expense', 3000),
          day('2026-11-07', 'expense', 5270),
          day('2026-11-07', 'expense', 999, 'USD'),
        ],
        months,
        'GTQ',
      ),
    ).toEqual([
      { month: '2026-09-01', incomeMinor: 500000, expenseMinor: 15000 },
      { month: '2026-10-01', incomeMinor: 0, expenseMinor: 0 },
      { month: '2026-11-01', incomeMinor: 0, expenseMinor: 5270 },
    ]);
  });
});

describe('balanceSeries', () => {
  it('walks back from today’s balance and stops at today', () => {
    const series = balanceSeries(
      [
        day('2026-11-02', 'income', 10000),
        day('2026-11-03', 'expense', 2500),
        day('2026-11-04', 'expense', 500),
      ],
      ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
      100000,
      'GTQ',
      '2026-11-04',
    );
    expect(series).toEqual([
      { localDate: '2026-11-01', balanceMinor: 93000 },
      { localDate: '2026-11-02', balanceMinor: 103000 },
      { localDate: '2026-11-03', balanceMinor: 100500 },
      { localDate: '2026-11-04', balanceMinor: 100000 },
    ]);
  });

  it('is empty for a month that has not started', () => {
    expect(balanceSeries([], ['2026-12-01'], 0, 'GTQ', '2026-11-30')).toEqual(
      [],
    );
  });
});

describe('foldSlices', () => {
  const slice = (key: string, valueMinor: number) => ({
    key,
    label: key,
    valueMinor,
  });

  it('keeps the largest and folds the rest into "Otros"', () => {
    expect(
      foldSlices(
        [slice('a', 10), slice('b', 50), slice('c', 5), slice('d', 30), slice('e', 1)],
        2,
      ),
    ).toEqual([
      slice('b', 50),
      slice('d', 30),
      { key: 'other', label: 'Otros', valueMinor: 16 },
    ]);
  });

  it('does not fold a single leftover slice and drops zeros', () => {
    expect(foldSlices([slice('a', 3), slice('b', 2), slice('z', 0)], 1)).toEqual(
      [slice('a', 3), slice('b', 2)],
    );
  });
});

describe('spendingByAccount', () => {
  it('labels card spending with the card and the rest with the account', () => {
    expect(
      spendingByAccount(
        [
          { accountId: 'm', cardId: null, currency: 'GTQ', totalMinor: 2825 },
          { accountId: 'c', cardId: 'v', currency: 'GTQ', totalMinor: 30270 },
          { accountId: 'c', cardId: null, currency: 'USD', totalMinor: 100 },
        ],
        'GTQ',
        {
          account: id => (id === 'm' ? 'BI Monetaria' : 'BI Visa'),
          card: () => ({ alias: 'Visa', last4: '4242' }),
        },
      ),
    ).toEqual([
      { key: 'c:v', label: 'Visa •••• 4242', valueMinor: 30270 },
      { key: 'm:', label: 'BI Monetaria', valueMinor: 2825 },
    ]);
  });
});
