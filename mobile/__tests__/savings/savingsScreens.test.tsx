import type { InitialState } from '@react-navigation/native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import type { Database } from '../../src/core/db';
import { createGatedTestDatabase } from '../../src/core/db/testing/createGatedTestDatabase';
import {
  createAccountRepository,
  type Account,
} from '../../src/features/accounts';
import {
  createSavingsGoalRepository,
  type NewSavingsGoal,
} from '../../src/features/savings';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../src/features/transactions';
import {
  formatLocalDate,
  localDateDaysBefore,
  todayLocalDate,
} from '../../src/shared/lib/dates';
import { formatMoney } from '../../src/shared/lib/money';
import {
  chooseAlertButton,
  spyOnAlerts,
} from '../../src/shared/testing/alerts';
import {
  canPress,
  flushAsync,
  hasText,
  inputValue,
  pressByTestId,
  typeByTestId,
} from '../../src/shared/testing/testRenderer';

let database: Database;
let gatedDatabase: Database;
let releaseQueries: () => void;
let databaseClosed: boolean;
let renderer: Renderer | null;

beforeEach(async () => {
  ({
    database,
    gated: gatedDatabase,
    release: releaseQueries,
  } = await createGatedTestDatabase());
  databaseClosed = false;
  renderer = null;
});

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await ReactTestRenderer.act(async () => {
      mounted.unmount();
    });
  }
  releaseQueries();
  await flushAsync();
  if (!databaseClosed) {
    await database.close();
  }
  jest.restoreAllMocks();
});

const SAVINGS_GOALS: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'SavingsGoals' }],
};
const NEW_GOAL: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'SavingsGoalForm' }],
};

async function open(
  state: InitialState = SAVINGS_GOALS,
  db: Database = database,
) {
  renderer = await renderRootStack(db, state);
  await flushAsync();
  return renderer;
}

const repos = () => ({
  accounts: createAccountRepository(database.db),
  goals: createSavingsGoalRepository(database.db),
  transactions: createTransactionRepository(database.db),
});

type Fixture = { checking: Account; savings: Account; credit: Account };

async function seed(savingsBalance = 0): Promise<Fixture> {
  const { accounts } = repos();
  const checking = await accounts.create({
    name: 'Monetaria',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 5000000,
  });
  const savings = await accounts.create({
    name: 'Ahorros',
    type: 'savings',
    currency: 'GTQ',
    initialBalanceMinor: savingsBalance,
  });
  const credit = await accounts.create({
    name: 'Visa',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  return { checking, savings, credit };
}

const laptop = (
  accountId: string,
  fields: Partial<NewSavingsGoal> = {},
): NewSavingsGoal => ({
  accountId,
  name: 'Laptop',
  targetAmountMinor: 1000000,
  targetDate: null,
  ...fields,
});

function transfer(
  from: Account,
  to: Account,
  amountMinor: number,
): NewTransaction {
  return {
    type: 'transfer',
    amountMinor,
    currency: 'GTQ',
    accountId: from.id,
    toAccountId: to.id,
    categoryId: null,
    cardId: null,
    occurredAt: new Date().toISOString(),
    localDate: todayLocalDate(),
    description: null,
    payee: null,
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
  };
}

function label(view: Renderer, testID: string): string | undefined {
  return view.root.findAll(
    node => node.props.testID === testID && node.props.accessibilityLabel,
  )[0]?.props.accessibilityLabel;
}

function progressBar(view: Renderer, goalId: string) {
  return view.root.findAll(
    node =>
      node.props.testID === `savings-goal-${goalId}-progress` &&
      node.props.accessibilityRole !== undefined,
  )[0];
}

const money = (amountMinor: number) => formatMoney(amountMinor, 'GTQ');

describe('Metas de ahorro screen', () => {
  it('opens from Configuración', async () => {
    const view = await open({
      routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Settings' }] } }],
    });
    await pressByTestId(view.root, 'settings-savings');
    expect(hasText(view, 'Aún no tienes metas de ahorro')).toBe(true);
  });

  it('shows a loading state until SQLite answers', async () => {
    const view = await open(SAVINGS_GOALS, gatedDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando metas de ahorro',
      ).length,
    ).toBeGreaterThan(0);
    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'Aún no tienes metas de ahorro')).toBe(true);
  });

  it('shows an error with a retry action that loads again', async () => {
    databaseClosed = true;
    await database.close();
    const view = await open();
    expect(hasText(view, 'No se pudieron cargar tus metas de ahorro')).toBe(
      true,
    );
    expect(canPress(view.root, 'savings-retry')).toBe(true);
    await pressByTestId(view.root, 'savings-retry');
    expect(hasText(view, 'No se pudieron cargar tus metas de ahorro')).toBe(
      true,
    );
  });

  it('shows the empty state with a create button', async () => {
    await seed();
    const view = await open();
    expect(hasText(view, 'Aún no tienes metas de ahorro')).toBe(true);

    await pressByTestId(view.root, 'savings-empty-add');
    expect(hasText(view, 'Cuenta donde ahorras')).toBe(true);
  });

  it('lists a goal with saved / target, percentage, account, date, status and one spoken sentence', async () => {
    const fixture = await seed(450000);
    const goal = await repos().goals.create(
      laptop(fixture.savings.id, { targetDate: '2099-12-15' }),
    );

    const view = await open();

    expect(hasText(view, 'Metas de ahorro')).toBe(true);
    expect(hasText(view, `${money(450000)} / ${money(1000000)}`)).toBe(true);
    expect(hasText(view, '45%')).toBe(true);
    expect(hasText(view, 'Cuenta: Ahorros')).toBe(true);
    expect(hasText(view, 'Fecha objetivo: 15 dic 2099')).toBe(true);
    expect(hasText(view, 'En progreso')).toBe(true);
    expect(label(view, `savings-goal-${goal.id}-summary`)).toBe(
      `Laptop, ${money(450000)} de ${money(
        1000000,
      )}, 45 por ciento, en progreso, cuenta Ahorros. Fecha objetivo: 15 dic 2099.`,
    );
    expect(progressBar(view, goal.id).props).toMatchObject({
      accessibilityRole: 'progressbar',
      accessibilityValue: {
        min: 0,
        max: 100,
        now: 45,
        text: '45 por ciento',
      },
    });
    expect(
      view.root.findAll(
        node =>
          node.props.testID === `savings-goal-${goal.id}-edit` &&
          node.props.accessibilityLabel === 'Editar meta Laptop',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('shows a reached goal', async () => {
    const fixture = await seed(1000000);
    await repos().goals.create(laptop(fixture.savings.id));
    const view = await open();
    expect(hasText(view, 'Meta alcanzada')).toBe(true);
    expect(hasText(view, '100%')).toBe(true);
  });

  it('shows a surpassed goal without capping the percentage; the bar stops at 100', async () => {
    const fixture = await seed(1250000);
    const goal = await repos().goals.create(laptop(fixture.savings.id));
    const view = await open();

    expect(hasText(view, `Meta superada por ${money(250000)}`)).toBe(true);
    expect(hasText(view, '125%')).toBe(true);
    expect(progressBar(view, goal.id).props.accessibilityValue).toMatchObject({
      now: 100,
      text: '125 por ciento',
    });
  });

  it('marks a past target date without changing the status', async () => {
    const fixture = await seed(100000);
    const yesterday = localDateDaysBefore(todayLocalDate(), 1);
    await repos().goals.create(
      laptop(fixture.savings.id, { targetDate: yesterday }),
    );
    const view = await open();

    expect(
      hasText(view, `Fecha objetivo: ${formatLocalDate(yesterday)} (pasada)`),
    ).toBe(true);
    expect(hasText(view, 'En progreso')).toBe(true);
  });
});

describe('creating and editing', () => {
  it('validates before saving', async () => {
    await seed();
    const view = await open(NEW_GOAL);
    await typeByTestId(view.root, 'savings-goal-date', '2026-02-30');
    await pressByTestId(view.root, 'savings-goal-submit');

    expect(hasText(view, 'Escribe un nombre para la meta.')).toBe(true);
    expect(hasText(view, 'Elige la cuenta donde ahorras.')).toBe(true);
    expect(hasText(view, 'Escribe el monto objetivo.')).toBe(true);
    expect(hasText(view, 'Escribe una fecha válida (AAAA-MM-DD).')).toBe(true);
    expect(await repos().goals.list()).toEqual([]);
  });

  it('creates a goal and shows it with the real balance when coming back', async () => {
    const fixture = await seed(450000);
    const view = await open();

    await pressByTestId(view.root, 'savings-empty-add');
    await typeByTestId(view.root, 'savings-goal-name', 'Laptop');
    await pressByTestId(
      view.root,
      `savings-goal-account-${fixture.savings.id}`,
    );
    await typeByTestId(view.root, 'savings-goal-target', '10,000');
    await typeByTestId(view.root, 'savings-goal-date', '2099-12-15');
    await pressByTestId(view.root, 'savings-goal-submit');

    const [created] = await repos().goals.list();
    expect(created).toMatchObject({
      accountId: fixture.savings.id,
      name: 'Laptop',
      targetAmountMinor: 1000000,
      targetDate: '2099-12-15',
    });
    expect(label(view, `savings-goal-${created.id}-summary`)).toContain(
      `Laptop, ${money(450000)} de ${money(1000000)}, 45 por ciento`,
    );
  });

  it('offers no credit card and disables accounts that already have a goal', async () => {
    const fixture = await seed();
    await repos().goals.create(laptop(fixture.savings.id));
    const view = await open(NEW_GOAL);

    expect(
      canPress(view.root, `savings-goal-account-${fixture.savings.id}`),
    ).toBe(false);
    expect(
      canPress(view.root, `savings-goal-account-${fixture.checking.id}`),
    ).toBe(true);
    expect(
      view.root.findAll(
        node =>
          node.props.testID === `savings-goal-account-${fixture.credit.id}`,
      ),
    ).toHaveLength(0);
  });

  it('shows a goal created meanwhile on the account field', async () => {
    const fixture = await seed();
    const view = await open(NEW_GOAL);
    await typeByTestId(view.root, 'savings-goal-name', 'Viaje');
    await pressByTestId(
      view.root,
      `savings-goal-account-${fixture.savings.id}`,
    );
    await typeByTestId(view.root, 'savings-goal-target', '500');
    await repos().goals.create(laptop(fixture.savings.id));

    await pressByTestId(view.root, 'savings-goal-submit');

    expect(
      hasText(view, 'Esa cuenta ya tiene una meta de ahorro activa.'),
    ).toBe(true);
    expect(await repos().goals.list()).toHaveLength(1);
  });

  it('offers to create an account when none can hold a goal', async () => {
    const { accounts } = repos();
    await accounts.create({
      name: 'Visa',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const view = await open(NEW_GOAL);
    expect(hasText(view, 'No tienes cuentas para ahorrar')).toBe(true);
    expect(canPress(view.root, 'savings-goal-create-account')).toBe(true);
  });

  it('edits name, target and date with the account locked', async () => {
    const fixture = await seed(450000);
    const goal = await repos().goals.create(
      laptop(fixture.savings.id, { targetDate: '2099-12-15' }),
    );
    const view = await open();

    await pressByTestId(view.root, `savings-goal-${goal.id}-edit`);
    expect(inputValue(view.root, 'savings-goal-name')).toBe('Laptop');
    expect(inputValue(view.root, 'savings-goal-target')).toBe('10000.00');
    expect(inputValue(view.root, 'savings-goal-date')).toBe('2099-12-15');
    expect(inputValue(view.root, 'savings-goal-account-locked')).toBe(
      'Ahorros',
    );
    await typeByTestId(view.root, 'savings-goal-name', 'Laptop gamer');
    await typeByTestId(view.root, 'savings-goal-target', '9,000');
    await typeByTestId(view.root, 'savings-goal-date', '');
    await pressByTestId(view.root, 'savings-goal-submit');

    expect(await repos().goals.getById(goal.id)).toMatchObject({
      accountId: fixture.savings.id,
      name: 'Laptop gamer',
      targetAmountMinor: 900000,
      targetDate: null,
    });
    expect(hasText(view, '50%')).toBe(true);
  });

  it('archives after the "¿Ya cumpliste esta meta?" confirmation', async () => {
    const fixture = await seed();
    const goal = await repos().goals.create(laptop(fixture.savings.id));
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open();

    await pressByTestId(view.root, `savings-goal-${goal.id}-edit`);
    await pressByTestId(view.root, 'savings-goal-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Ya cumpliste esta meta?',
      'Archivarla la quitará de tu lista de metas activas. Tu cuenta, su saldo y tus movimientos no cambian.',
      expect.any(Array),
    );
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(await repos().goals.list()).toEqual([]);
    expect(await repos().accounts.getById(fixture.savings.id)).not.toBeNull();
    expect(hasText(view, 'Aún no tienes metas de ahorro')).toBe(true);
  });

  it('keeps the goal when archiving is cancelled', async () => {
    const fixture = await seed();
    const goal = await repos().goals.create(laptop(fixture.savings.id));
    const { lastButtons } = spyOnAlerts();
    const view = await open();

    await pressByTestId(view.root, `savings-goal-${goal.id}-edit`);
    await pressByTestId(view.root, 'savings-goal-archive');
    await chooseAlertButton(lastButtons(), 'Cancelar');

    expect(await repos().goals.getById(goal.id)).not.toBeNull();
    expect(canPress(view.root, 'savings-goal-archive')).toBe(true);
  });
});

describe('accounts with a goal', () => {
  it('explains why an account with an active goal cannot be archived', async () => {
    const fixture = await seed();
    await repos().goals.create(laptop(fixture.savings.id));
    const { alert, lastButtons } = spyOnAlerts();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const view = await open({
      routes: [
        { name: 'MainTabs' },
        { name: 'AccountDetail', params: { accountId: fixture.savings.id } },
      ],
    });

    await pressByTestId(view.root, 'account-archive');
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(alert).toHaveBeenLastCalledWith(
      'No se pudo archivar la cuenta',
      'Esta cuenta tiene una meta de ahorro activa. Archiva primero la meta en Configuración → Metas de ahorro.',
    );
    expect(consoleError).toHaveBeenCalled();
    expect(await repos().accounts.getById(fixture.savings.id)).not.toBeNull();
  });

  it('explains why an account with an active goal cannot become a credit card', async () => {
    const fixture = await seed();
    await repos().goals.create(laptop(fixture.savings.id));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const view = await open({
      routes: [
        { name: 'MainTabs' },
        { name: 'AccountForm', params: { accountId: fixture.savings.id } },
      ],
    });

    await pressByTestId(view.root, 'account-type-credit_card');
    await pressByTestId(view.root, 'account-submit');

    expect(
      hasText(
        view,
        'Esta cuenta tiene una meta de ahorro activa y no puede convertirse en tarjeta de crédito. Archiva primero la meta en Configuración → Metas de ahorro.',
      ),
    ).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    expect(
      (await repos().accounts.getById(fixture.savings.id))?.type,
    ).toBe('savings');
  });
});

describe('refresh', () => {
  it('reflects a transfer to the savings account after coming back', async () => {
    const fixture = await seed();
    const goal = await repos().goals.create(laptop(fixture.savings.id));
    const view = await open();
    expect(label(view, `savings-goal-${goal.id}-summary`)).toContain(
      `${money(0)} de ${money(1000000)}, 0 por ciento`,
    );

    // Leave and come back: the edit form, then save without changes.
    await pressByTestId(view.root, `savings-goal-${goal.id}-edit`);
    await repos().transactions.create(
      transfer(fixture.checking, fixture.savings, 450000),
    );
    await pressByTestId(view.root, 'savings-goal-submit');

    expect(label(view, `savings-goal-${goal.id}-summary`)).toContain(
      `${money(450000)} de ${money(1000000)}, 45 por ciento`,
    );
  });
});
