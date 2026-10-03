import {
  formatPercentUsed,
  spokenPercentUsed,
} from '../../src/features/budgets/components/budgetPresentation';
import { describeBudgetStatus } from '../../src/features/budgets/components/budgetMessages';
import { parseBudgetForm } from '../../src/features/budgets/components/budgetFormModel';
import {
  buildBudgetOverview,
  evaluateBudget,
  sortBudgetProgress,
  validateBudget,
  type Budget,
  type BudgetValidationContext,
} from '../../src/features/budgets';
import { formatMoney } from '../../src/shared/lib/money';

const NOW = '2026-10-01T12:00:00.000Z';
const PERIOD = { from: '2026-10-01', to: '2026-10-31' };

const FOOD = { id: 'food', kind: 'expense', deletedAt: null };

function budget(fields: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    categoryId: 'food',
    amountMinor: 200000,
    currency: 'GTQ',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...fields,
  };
}

const context = (
  overrides: Partial<BudgetValidationContext> = {},
): BudgetValidationContext => ({ category: FOOD, existing: [], ...overrides });

const valid = { categoryId: 'food', amountMinor: 200000, currency: 'GTQ' };

describe('validateBudget', () => {
  it('accepts a positive limit for an active expense category', () => {
    expect(validateBudget(valid, context())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['decimal', 10.5],
    ['beyond a safe integer', Number.MAX_SAFE_INTEGER + 1],
    ['not a number', Number.NaN],
  ])('rejects a %s amount', (_label, amountMinor) => {
    expect(validateBudget({ ...valid, amountMinor }, context()).errors).toEqual(
      ['amount_invalid'],
    );
  });

  it('accepts the largest safe integer', () => {
    expect(
      validateBudget(
        { ...valid, amountMinor: Number.MAX_SAFE_INTEGER },
        context(),
      ).valid,
    ).toBe(true);
  });

  it.each(['gtq', 'GT', 'GTQX', '', '123'])(
    'rejects the currency %p',
    currency => {
      expect(validateBudget({ ...valid, currency }, context()).errors).toEqual([
        'currency_invalid',
      ]);
    },
  );

  it('needs a category that exists', () => {
    expect(
      validateBudget({ ...valid, categoryId: null }, context()).errors,
    ).toEqual(['category_required']);
    expect(validateBudget(valid, context({ category: null })).errors).toEqual([
      'category_not_found',
    ]);
  });

  it('rejects an income category', () => {
    expect(
      validateBudget(
        valid,
        context({ category: { id: 'food', kind: 'income', deletedAt: null } }),
      ).errors,
    ).toEqual(['category_not_expense']);
  });

  it('rejects an archived category for a new budget but keeps it when editing', () => {
    const archived = { ...FOOD, deletedAt: NOW };
    expect(
      validateBudget(valid, context({ category: archived })).errors,
    ).toEqual(['category_archived']);
    expect(
      validateBudget(
        valid,
        context({
          category: archived,
          existing: [budget()],
          currentId: 'b1',
        }),
      ).valid,
    ).toBe(true);
  });

  it('allows one active budget per category and currency', () => {
    const existing = [budget()];
    expect(validateBudget(valid, context({ existing })).errors).toEqual([
      'budget_duplicate',
    ]);
    // Same category in another currency is a different budget.
    expect(
      validateBudget({ ...valid, currency: 'USD' }, context({ existing }))
        .valid,
    ).toBe(true);
    // Editing a budget is not a duplicate of itself.
    expect(
      validateBudget(valid, context({ existing, currentId: 'b1' })).valid,
    ).toBe(true);
  });

  it('reports every broken rule at once', () => {
    expect(
      validateBudget(
        { categoryId: 'food', amountMinor: 0, currency: 'x' },
        context({ category: null }),
      ).errors,
    ).toEqual(['category_not_found', 'amount_invalid', 'currency_invalid']);
  });
});

describe('evaluateBudget', () => {
  const limit = budget({ amountMinor: 100000 });

  it('with no spending: everything available, 0%, ok', () => {
    const progress = evaluateBudget(limit, 0);
    expect(progress).toMatchObject({
      spentMinor: 0,
      remainingMinor: 100000,
      status: 'ok',
    });
    expect(formatPercentUsed(progress)).toBe('0%');
  });

  it('with partial spending', () => {
    const progress = evaluateBudget(budget(), 100000);
    expect(progress).toMatchObject({ remainingMinor: 100000, status: 'ok' });
    expect(formatPercentUsed(progress)).toBe('50%');
  });

  it('warns from 80% (20% or less left) while under the limit', () => {
    expect(evaluateBudget(limit, 79999).status).toBe('ok');
    expect(evaluateBudget(limit, 80000).status).toBe('warning');
    expect(evaluateBudget(limit, 99999).status).toBe('warning');
  });

  it('is exact for limits not divisible by 5', () => {
    const odd = budget({ amountMinor: 7 }); // 20% = 1.4
    expect(evaluateBudget(odd, 5).status).toBe('ok'); // 2 left
    expect(evaluateBudget(odd, 6).status).toBe('warning'); // 1 left
  });

  it('is reached at exactly the limit', () => {
    expect(evaluateBudget(limit, 100000)).toMatchObject({
      remainingMinor: 0,
      status: 'reached',
    });
  });

  it('shows how much it is exceeded, without capping the percentage', () => {
    const progress = evaluateBudget(limit, 125000);
    expect(progress).toMatchObject({
      spentMinor: 125000,
      remainingMinor: -25000,
      status: 'exceeded',
    });
    expect(formatPercentUsed(progress)).toBe('125%');
    expect(spokenPercentUsed(progress)).toBe('125 por ciento');
    expect(describeBudgetStatus(progress)).toBe(
      `Excedido por ${formatMoney(25000, 'GTQ')}`,
    );
  });

  it('does not overflow with the largest amounts', () => {
    const huge = budget({ amountMinor: Number.MAX_SAFE_INTEGER });
    expect(evaluateBudget(huge, Number.MAX_SAFE_INTEGER - 1).status).toBe(
      'warning',
    );
  });

  it('describes every status in words', () => {
    expect(describeBudgetStatus(evaluateBudget(limit, 0))).toBe('En orden');
    expect(describeBudgetStatus(evaluateBudget(limit, 90000))).toBe(
      'Por acercarse al límite',
    );
    expect(describeBudgetStatus(evaluateBudget(limit, 100000))).toBe(
      'Límite alcanzado',
    );
  });
});

describe('buildBudgetOverview', () => {
  it('matches spending by category and currency, never across currencies', () => {
    const overview = buildBudgetOverview(
      [budget()],
      [
        { categoryId: 'food', currency: 'GTQ', totalMinor: 125000 },
        { categoryId: 'food', currency: 'USD', totalMinor: 10000 },
      ],
      PERIOD,
    );
    expect(overview.period).toEqual(PERIOD);
    expect(overview.budgets).toEqual([
      expect.objectContaining({ spentMinor: 125000, remainingMinor: 75000 }),
    ]);
    expect(overview.unbudgeted).toEqual([
      { categoryId: 'food', currency: 'USD', spentMinor: 10000 },
    ]);
  });

  it('lists categories with spending but no budget, uncategorized included', () => {
    const overview = buildBudgetOverview(
      [],
      [
        { categoryId: 'car', currency: 'GTQ', totalMinor: 5000 },
        { categoryId: null, currency: 'GTQ', totalMinor: 300 },
      ],
      PERIOD,
    );
    expect(overview.budgets).toEqual([]);
    expect(overview.unbudgeted).toEqual([
      { categoryId: 'car', currency: 'GTQ', spentMinor: 5000 },
      { categoryId: null, currency: 'GTQ', spentMinor: 300 },
    ]);
  });

  it('gives a budget without spending zero spent', () => {
    const [progress] = buildBudgetOverview([budget()], [], PERIOD).budgets;
    expect(progress).toMatchObject({ spentMinor: 0, status: 'ok' });
  });
});

describe('sortBudgetProgress', () => {
  it('orders exceeded, warning, reached, ok; then by category name', () => {
    const names: Record<string, string> = {
      a: 'Viajes',
      b: 'Alimentación',
      c: 'Salud',
      d: 'Compras',
      e: 'Educación',
    };
    const progress = [
      evaluateBudget(budget({ id: 'ok', categoryId: 'a' }), 0),
      evaluateBudget(budget({ id: 'reached', categoryId: 'b' }), 200000),
      evaluateBudget(budget({ id: 'warning', categoryId: 'c' }), 190000),
      evaluateBudget(budget({ id: 'exceeded', categoryId: 'd' }), 300000),
      evaluateBudget(budget({ id: 'ok2', categoryId: 'e' }), 0),
    ];
    expect(
      sortBudgetProgress(progress, id => names[id]).map(p => p.budget.id),
    ).toEqual(['exceeded', 'warning', 'reached', 'ok2', 'ok']);
  });
});

describe('parseBudgetForm', () => {
  it('parses the amount without floating point', () => {
    expect(
      parseBudgetForm(
        { categoryId: 'food', amount: '1,500.50' },
        'GTQ',
        context(),
      ),
    ).toEqual({
      ok: true,
      input: { categoryId: 'food', amountMinor: 150050, currency: 'GTQ' },
    });
  });

  it('explains each invalid field', () => {
    const result = parseBudgetForm(
      { categoryId: null, amount: '' },
      'GTQ',
      context(),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        categoryId: 'Elige una categoría.',
        amount: 'Escribe el monto del presupuesto.',
      },
    });
    expect(
      parseBudgetForm({ categoryId: 'food', amount: '0' }, 'GTQ', context()),
    ).toEqual({
      ok: false,
      errors: { amount: 'El presupuesto debe ser mayor que cero.' },
    });
    expect(
      parseBudgetForm(
        { categoryId: 'food', amount: '10.123' },
        'GTQ',
        context(),
      ),
    ).toEqual({
      ok: false,
      errors: { amount: 'Usa como máximo 2 decimales.' },
    });
  });
});
