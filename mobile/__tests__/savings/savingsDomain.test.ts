import { parseSavingsGoalForm } from '../../src/features/savings/components/savingsGoalFormModel';
import { describeSavingsStatus } from '../../src/features/savings/components/savingsMessages';
import {
  describeTargetDate,
  formatPercentSaved,
  spokenPercentSaved,
} from '../../src/features/savings/components/savingsPresentation';
import {
  buildSavingsOverview,
  evaluateSavingsGoal,
  sortSavingsGoals,
  validateSavingsGoal,
  type SavingsGoal,
  type SavingsGoalValidationContext,
} from '../../src/features/savings';
import { formatMoney } from '../../src/shared/lib/money';

const NOW = '2026-10-01T12:00:00.000Z';

const SAVINGS = { id: 'savings', type: 'savings', deletedAt: null };

function goal(fields: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'g1',
    accountId: 'savings',
    name: 'Laptop',
    targetAmountMinor: 1000000,
    targetDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...fields,
  };
}

const context = (
  overrides: Partial<SavingsGoalValidationContext> = {},
): SavingsGoalValidationContext => ({
  account: SAVINGS,
  existing: [],
  ...overrides,
});

const valid = {
  name: 'Laptop',
  accountId: 'savings',
  targetAmountMinor: 1000000,
  targetDate: null,
};

describe('validateSavingsGoal', () => {
  it('accepts a named goal with a positive target on an active savings account', () => {
    expect(validateSavingsGoal(valid, context())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each(['bank', 'cash', 'other'])('accepts a %s account', type => {
    expect(
      validateSavingsGoal(valid, context({ account: { ...SAVINGS, type } }))
        .valid,
    ).toBe(true);
  });

  it.each(['', '   '])('rejects the empty name %p', name => {
    expect(validateSavingsGoal({ ...valid, name }, context()).errors).toEqual([
      'name_required',
    ]);
  });

  it('accepts 60 characters and rejects 61, after trimming', () => {
    expect(
      validateSavingsGoal({ ...valid, name: ` ${'a'.repeat(60)} ` }, context())
        .valid,
    ).toBe(true);
    expect(
      validateSavingsGoal({ ...valid, name: 'a'.repeat(61) }, context()).errors,
    ).toEqual(['name_too_long']);
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['decimal', 10.5],
    ['beyond a safe integer', Number.MAX_SAFE_INTEGER + 1],
    ['not a number', Number.NaN],
  ])('rejects a %s target', (_label, targetAmountMinor) => {
    expect(
      validateSavingsGoal({ ...valid, targetAmountMinor }, context()).errors,
    ).toEqual(['target_invalid']);
  });

  it('accepts the largest safe integer', () => {
    expect(
      validateSavingsGoal(
        { ...valid, targetAmountMinor: Number.MAX_SAFE_INTEGER },
        context(),
      ).valid,
    ).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '15/12/2026', '2026-1-5', 'mañana'])(
    'rejects the target date %p',
    targetDate => {
      expect(
        validateSavingsGoal({ ...valid, targetDate }, context()).errors,
      ).toEqual(['target_date_invalid']);
    },
  );

  it('accepts a past target date and no date at all', () => {
    expect(
      validateSavingsGoal({ ...valid, targetDate: '2020-01-31' }, context())
        .valid,
    ).toBe(true);
    expect(
      validateSavingsGoal({ ...valid, targetDate: '2028-02-29' }, context())
        .valid,
    ).toBe(true);
  });

  it('needs an account that exists', () => {
    expect(
      validateSavingsGoal({ ...valid, accountId: null }, context()).errors,
    ).toEqual(['account_required']);
    expect(
      validateSavingsGoal(valid, context({ account: null })).errors,
    ).toEqual(['account_not_found']);
  });

  it('rejects an archived account for a new goal', () => {
    expect(
      validateSavingsGoal(
        valid,
        context({ account: { ...SAVINGS, deletedAt: NOW } }),
      ).errors,
    ).toEqual(['account_archived']);
  });

  it('rejects a credit card account', () => {
    expect(
      validateSavingsGoal(
        valid,
        context({ account: { ...SAVINGS, type: 'credit_card' } }),
      ).errors,
    ).toEqual(['account_type_invalid']);
  });

  it('allows one active goal per account; editing is not its own duplicate', () => {
    const existing = [goal()];
    expect(validateSavingsGoal(valid, context({ existing })).errors).toEqual([
      'account_has_goal',
    ]);
    expect(
      validateSavingsGoal(
        { ...valid, accountId: 'bank' },
        context({ existing, account: { ...SAVINGS, id: 'bank' } }),
      ).valid,
    ).toBe(true);
    expect(
      validateSavingsGoal(
        { ...valid, name: 'Laptop nueva' },
        context({ existing, currentId: 'g1' }),
      ).valid,
    ).toBe(true);
  });

  it('allows the same name on different accounts', () => {
    expect(
      validateSavingsGoal(
        { ...valid, accountId: 'bank' },
        context({
          existing: [goal()],
          account: { ...SAVINGS, id: 'bank' },
        }),
      ).valid,
    ).toBe(true);
  });

  it('reports every broken rule at once', () => {
    expect(
      validateSavingsGoal(
        { name: '', accountId: 'x', targetAmountMinor: 0, targetDate: 'x' },
        context({ account: null }),
      ).errors,
    ).toEqual([
      'name_required',
      'target_invalid',
      'target_date_invalid',
      'account_not_found',
    ]);
  });
});

describe('evaluateSavingsGoal', () => {
  const laptop = goal({ targetAmountMinor: 1000000 });

  it('with nothing saved: 0%, in progress', () => {
    const progress = evaluateSavingsGoal(laptop, 0, 'GTQ');
    expect(progress).toMatchObject({
      savedMinor: 0,
      remainingMinor: 1000000,
      status: 'in_progress',
      currency: 'GTQ',
    });
    expect(formatPercentSaved(progress)).toBe('0%');
    expect(describeSavingsStatus(progress)).toBe('En progreso');
  });

  it('with part saved', () => {
    const progress = evaluateSavingsGoal(laptop, 450000, 'GTQ');
    expect(progress).toMatchObject({
      remainingMinor: 550000,
      status: 'in_progress',
    });
    expect(formatPercentSaved(progress)).toBe('45%');
    expect(spokenPercentSaved(progress)).toBe('45 por ciento');
  });

  it('is in progress one minor unit short and reached at exactly the target', () => {
    expect(evaluateSavingsGoal(laptop, 999999, 'GTQ').status).toBe(
      'in_progress',
    );
    const reached = evaluateSavingsGoal(laptop, 1000000, 'GTQ');
    expect(reached).toMatchObject({ remainingMinor: 0, status: 'reached' });
    expect(formatPercentSaved(reached)).toBe('100%');
    expect(describeSavingsStatus(reached)).toBe('Meta alcanzada');
  });

  it('shows how much it is surpassed, without capping the percentage', () => {
    const progress = evaluateSavingsGoal(laptop, 1250000, 'GTQ');
    expect(progress).toMatchObject({
      remainingMinor: -250000,
      status: 'reached',
    });
    expect(formatPercentSaved(progress)).toBe('125%');
    expect(describeSavingsStatus(progress)).toBe(
      `Meta superada por ${formatMoney(250000, 'GTQ')}`,
    );
  });

  it('keeps a negative balance but shows 0%', () => {
    const progress = evaluateSavingsGoal(laptop, -5000, 'GTQ');
    expect(progress).toMatchObject({
      savedMinor: -5000,
      remainingMinor: 1005000,
      status: 'in_progress',
    });
    expect(formatPercentSaved(progress)).toBe('0%');
  });

  it('does not overflow with the largest amounts', () => {
    const huge = goal({ targetAmountMinor: Number.MAX_SAFE_INTEGER });
    expect(
      evaluateSavingsGoal(huge, Number.MAX_SAFE_INTEGER - 1, 'GTQ').status,
    ).toBe('in_progress');
    expect(
      evaluateSavingsGoal(huge, Number.MAX_SAFE_INTEGER, 'GTQ').status,
    ).toBe('reached');
  });
});

describe('describeTargetDate', () => {
  it('marks only a past date', () => {
    expect(describeTargetDate('2026-12-15', '2026-10-01')).toBe(
      'Fecha objetivo: 15 dic 2026',
    );
    expect(describeTargetDate('2026-10-01', '2026-10-01')).toBe(
      'Fecha objetivo: 1 oct 2026',
    );
    expect(describeTargetDate('2026-09-30', '2026-10-01')).toBe(
      'Fecha objetivo: 30 sep 2026 (pasada)',
    );
  });
});

describe('buildSavingsOverview', () => {
  it('uses each account balance and currency as the goal’s', () => {
    const overview = buildSavingsOverview(
      [
        goal({ id: 'g1', accountId: 'gtq' }),
        goal({ id: 'g2', accountId: 'usd', targetAmountMinor: 100000 }),
      ],
      { gtq: 450000, usd: 25000, other: 999999 },
      [
        { id: 'gtq', currency: 'GTQ' },
        { id: 'usd', currency: 'USD' },
      ],
    );
    expect(overview.goals).toEqual([
      expect.objectContaining({
        savedMinor: 450000,
        currency: 'GTQ',
        status: 'in_progress',
      }),
      expect.objectContaining({
        savedMinor: 25000,
        currency: 'USD',
        remainingMinor: 75000,
      }),
    ]);
  });

  it('counts an account without a balance as nothing saved', () => {
    const [progress] = buildSavingsOverview([goal()], {}, []).goals;
    expect(progress).toMatchObject({ savedMinor: 0, status: 'in_progress' });
  });
});

describe('sortSavingsGoals', () => {
  it('orders in progress before reached; nearest date first, undated last; then by name', () => {
    const progress = [
      evaluateSavingsGoal(goal({ id: 'reached', name: 'A' }), 2000000, 'GTQ'),
      evaluateSavingsGoal(goal({ id: 'undated', name: 'Auto' }), 0, 'GTQ'),
      evaluateSavingsGoal(
        goal({ id: 'late', name: 'Viaje', targetDate: '2027-06-01' }),
        0,
        'GTQ',
      ),
      evaluateSavingsGoal(
        goal({ id: 'soon', name: 'Zapatos', targetDate: '2026-11-01' }),
        0,
        'GTQ',
      ),
      evaluateSavingsGoal(goal({ id: 'undated2', name: 'Bici' }), 0, 'GTQ'),
    ];
    expect(sortSavingsGoals(progress).map(p => p.goal.id)).toEqual([
      'soon',
      'late',
      'undated',
      'undated2',
      'reached',
    ]);
  });
});

describe('parseSavingsGoalForm', () => {
  it('parses the target without floating point and trims the name', () => {
    expect(
      parseSavingsGoalForm(
        {
          name: '  Laptop ',
          accountId: 'savings',
          target: '10,000.50',
          targetDate: '2026-12-15',
        },
        'GTQ',
        context(),
      ),
    ).toEqual({
      ok: true,
      input: {
        accountId: 'savings',
        name: 'Laptop',
        targetAmountMinor: 1000050,
        targetDate: '2026-12-15',
      },
    });
  });

  it('treats an empty date as none', () => {
    const result = parseSavingsGoalForm(
      { name: 'Laptop', accountId: 'savings', target: '100', targetDate: ' ' },
      'GTQ',
      context(),
    );
    expect(result).toMatchObject({ ok: true, input: { targetDate: null } });
  });

  it('explains each invalid field', () => {
    expect(
      parseSavingsGoalForm(
        { name: '', accountId: null, target: '', targetDate: '2026-02-30' },
        'GTQ',
        context(),
      ),
    ).toEqual({
      ok: false,
      errors: {
        name: 'Escribe un nombre para la meta.',
        accountId: 'Elige la cuenta donde ahorras.',
        target: 'Escribe el monto objetivo.',
        targetDate: 'Escribe una fecha válida (AAAA-MM-DD).',
      },
    });
    expect(
      parseSavingsGoalForm(
        { name: 'Laptop', accountId: 'savings', target: '0', targetDate: '' },
        'GTQ',
        context(),
      ),
    ).toEqual({
      ok: false,
      errors: { target: 'El monto objetivo debe ser mayor que cero.' },
    });
  });
});
