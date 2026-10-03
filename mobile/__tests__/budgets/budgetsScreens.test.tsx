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
import { createBudgetRepository } from '../../src/features/budgets';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../src/features/transactions';
import { todayLocalDate } from '../../src/shared/lib/dates';
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

const BUDGETS: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'Budgets' }],
};

async function open(state: InitialState = BUDGETS, db: Database = database) {
  renderer = await renderRootStack(db, state);
  await flushAsync();
  return renderer;
}

const repos = () => ({
  accounts: createAccountRepository(database.db),
  budgets: createBudgetRepository(database.db),
  categories: createCategoryRepository(database.db),
  transactions: createTransactionRepository(database.db),
});

type Fixture = {
  bank: Account;
  food: Category;
  groceries: Category;
  transport: Category;
};

async function seed(): Promise<Fixture> {
  const { accounts, categories } = repos();
  const bank = await accounts.create({
    name: 'Banco Industrial',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 1000000,
  });
  const all = await categories.list();
  const named = (name: string) => all.find(c => c.name === name)!;
  return {
    bank,
    food: named('Alimentación'),
    groceries: named('Supermercado'),
    transport: named('Transporte'),
  };
}

function expense(
  fixture: Fixture,
  categoryId: string | null,
  amountMinor: number,
): NewTransaction {
  return {
    type: 'expense',
    amountMinor,
    currency: 'GTQ',
    accountId: fixture.bank.id,
    toAccountId: null,
    categoryId,
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

/** Budget items in screen order. */
function budgetOrder(view: Renderer): string[] {
  const ids = view.root
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        /^budget-[0-9a-f-]{36}$/.test(node.props.testID),
    )
    .map(node => node.props.testID as string);
  return [...new Set(ids)];
}

const money = (amountMinor: number) => formatMoney(amountMinor, 'GTQ');

describe('Presupuestos screen', () => {
  it('opens from Configuración', async () => {
    const view = await open({
      routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Settings' }] } }],
    });
    await pressByTestId(view.root, 'settings-budgets');
    expect(hasText(view, 'Aún no tienes presupuestos')).toBe(true);
  });

  it('shows a loading state until SQLite answers', async () => {
    const view = await open(BUDGETS, gatedDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando presupuestos',
      ).length,
    ).toBeGreaterThan(0);
    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'Aún no tienes presupuestos')).toBe(true);
  });

  it('shows an error with a retry action', async () => {
    databaseClosed = true;
    await database.close();
    const view = await open();
    expect(hasText(view, 'No se pudieron cargar tus presupuestos')).toBe(true);
    expect(canPress(view.root, 'budgets-retry')).toBe(true);
  });

  it('shows the empty state with no demo data', async () => {
    const view = await open();
    expect(hasText(view, 'Aún no tienes presupuestos')).toBe(true);
    expect(canPress(view.root, 'budgets-empty-add')).toBe(true);

    await pressByTestId(view.root, 'budgets-empty-add');
    expect(
      hasText(view, 'Por ahora los presupuestos usan quetzales (GTQ).'),
    ).toBe(true);
  });

  it('lists each budget with spent, available, percentage and status', async () => {
    const fixture = await seed();
    const { budgets, transactions } = repos();
    const budget = await budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 200000,
      currency: 'GTQ',
    });
    await transactions.create(expense(fixture, fixture.food.id, 125000));

    const view = await open();

    expect(label(view, `budget-${budget.id}-summary`)).toBe(
      `Alimentación, gastado ${money(125000)} de ${money(
        200000,
      )}, 62.5 por ciento, disponible ${money(75000)}. En orden.`,
    );
    expect(hasText(view, `${money(200000)} presupuesto`)).toBe(true);
    expect(hasText(view, '62.5%')).toBe(true);
    const bar = view.root.findAll(
      node =>
        node.props.testID === `budget-${budget.id}-progress` &&
        node.props.accessibilityRole !== undefined,
    )[0];
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: 63,
      text: '62.5 por ciento',
    });
  });

  it('shows an exceeded budget without capping the percentage, first in the list', async () => {
    const fixture = await seed();
    const { budgets, transactions } = repos();
    const ok = await budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 200000,
      currency: 'GTQ',
    });
    const over = await budgets.create({
      categoryId: fixture.transport.id,
      amountMinor: 100000,
      currency: 'GTQ',
    });
    await transactions.create(expense(fixture, fixture.transport.id, 125000));

    const view = await open();

    expect(hasText(view, `Excedido por ${money(25000)}`)).toBe(true);
    expect(hasText(view, '125%')).toBe(true);
    expect(budgetOrder(view)).toEqual([`budget-${over.id}`, `budget-${ok.id}`]);
  });
});

describe('creating and editing', () => {
  it('validates before saving', async () => {
    await seed();
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'BudgetForm' }],
    });
    await pressByTestId(view.root, 'budget-submit');
    expect(hasText(view, 'Elige una categoría.')).toBe(true);
    expect(hasText(view, 'Escribe el monto del presupuesto.')).toBe(true);
    expect(await repos().budgets.list()).toEqual([]);
  });

  it('creates a budget and shows it when coming back', async () => {
    const fixture = await seed();
    await repos().transactions.create(
      expense(fixture, fixture.groceries.id, 50000),
    );
    const view = await open();

    await pressByTestId(view.root, 'budgets-add');
    await pressByTestId(view.root, `budget-category-${fixture.groceries.id}`);
    await typeByTestId(view.root, 'budget-amount', '1,000');
    await pressByTestId(view.root, 'budget-submit');

    const [created] = await repos().budgets.list();
    expect(created).toMatchObject({
      categoryId: fixture.groceries.id,
      amountMinor: 100000,
      currency: 'GTQ',
    });
    expect(label(view, `budget-${created.id}-summary`)).toContain(
      `gastado ${money(50000)} de ${money(100000)}, 50 por ciento`,
    );
  });

  it('disables categories that already have a budget', async () => {
    const fixture = await seed();
    await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 1000,
      currency: 'GTQ',
    });
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'BudgetForm' }],
    });

    expect(canPress(view.root, `budget-category-${fixture.food.id}`)).toBe(
      false,
    );
    expect(canPress(view.root, `budget-category-${fixture.groceries.id}`)).toBe(
      true,
    );
    // Archived and income categories are not offered.
    expect(hasText(view, 'Salario')).toBe(false);
  });

  it('shows a duplicate created meanwhile on the category field', async () => {
    const fixture = await seed();
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'BudgetForm' }],
    });
    await pressByTestId(view.root, `budget-category-${fixture.food.id}`);
    await typeByTestId(view.root, 'budget-amount', '500');
    await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 1000,
      currency: 'GTQ',
    });

    await pressByTestId(view.root, 'budget-submit');

    expect(hasText(view, 'Esa categoría ya tiene un presupuesto.')).toBe(true);
    expect(await repos().budgets.list()).toHaveLength(1);
  });

  it('edits only the limit', async () => {
    const fixture = await seed();
    const budget = await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 200000,
      currency: 'GTQ',
    });
    const view = await open();

    await pressByTestId(view.root, `budget-${budget.id}-edit`);
    expect(inputValue(view.root, 'budget-amount')).toBe('2000.00');
    expect(inputValue(view.root, 'budget-category-locked')).toBe(
      'Alimentación',
    );
    await typeByTestId(view.root, 'budget-amount', '1500');
    await pressByTestId(view.root, 'budget-submit');

    expect(await repos().budgets.getById(budget.id)).toMatchObject({
      amountMinor: 150000,
      categoryId: fixture.food.id,
      currency: 'GTQ',
    });
    expect(hasText(view, `${money(150000)} presupuesto`)).toBe(true);
  });

  it('archives after confirmation and leaves the list', async () => {
    const fixture = await seed();
    const budget = await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 200000,
      currency: 'GTQ',
    });
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open();

    await pressByTestId(view.root, `budget-${budget.id}-edit`);
    await pressByTestId(view.root, 'budget-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Archivar presupuesto?',
      'Dejará de aparecer en tus presupuestos. Tus movimientos no cambian.',
      expect.any(Array),
    );
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(await repos().budgets.list()).toEqual([]);
    expect(hasText(view, 'Aún no tienes presupuestos')).toBe(true);
  });

  it('keeps the budget when archiving is cancelled', async () => {
    const fixture = await seed();
    const budget = await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 200000,
      currency: 'GTQ',
    });
    const { lastButtons } = spyOnAlerts();
    const view = await open();

    await pressByTestId(view.root, `budget-${budget.id}-edit`);
    await pressByTestId(view.root, 'budget-archive');
    await chooseAlertButton(lastButtons(), 'Cancelar');

    expect(await repos().budgets.getById(budget.id)).not.toBeNull();
    expect(canPress(view.root, 'budget-archive')).toBe(true);
  });
});

describe('Sin presupuesto', () => {
  it('lists spending without a budget and creates one for that category', async () => {
    const fixture = await seed();
    const { transactions } = repos();
    await transactions.create(expense(fixture, fixture.groceries.id, 40000));
    await transactions.create(expense(fixture, null, 1500));
    const view = await open();

    expect(hasText(view, 'Sin presupuesto')).toBe(true);
    expect(hasText(view, 'Supermercado')).toBe(true);
    expect(hasText(view, `${money(40000)} gastado · GTQ`)).toBe(true);
    expect(hasText(view, 'Sin categoría')).toBe(true);
    expect(canPress(view.root, 'budgets-create-none-GTQ')).toBe(false);

    await pressByTestId(
      view.root,
      `budgets-create-${fixture.groceries.id}-GTQ`,
    );
    await typeByTestId(view.root, 'budget-amount', '450');
    await pressByTestId(view.root, 'budget-submit');

    expect(await repos().budgets.list()).toEqual([
      expect.objectContaining({
        categoryId: fixture.groceries.id,
        amountMinor: 45000,
      }),
    ]);
    expect(hasText(view, 'Por acercarse al límite')).toBe(true);
  });
});

describe('archived categories', () => {
  it('keeps calculating a budget whose category was archived', async () => {
    const fixture = await seed();
    const budget = await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 100000,
      currency: 'GTQ',
    });
    await repos().transactions.create(expense(fixture, fixture.food.id, 30000));
    await repos().categories.softDelete(fixture.food.id);

    const view = await open();

    expect(label(view, `budget-${budget.id}-summary`)).toContain(
      `gastado ${money(30000)} de ${money(100000)}`,
    );
    expect(label(view, `budget-${budget.id}-summary`)).toContain(
      'Categoría archivada.',
    );
  });

  it('offers no "Crear presupuesto" for an archived category without budget', async () => {
    const fixture = await seed();
    await repos().transactions.create(
      expense(fixture, fixture.transport.id, 9000),
    );
    await repos().categories.softDelete(fixture.transport.id);

    const view = await open();

    expect(hasText(view, 'Transporte')).toBe(true);
    expect(hasText(view, 'Categoría archivada')).toBe(true);
    expect(
      canPress(view.root, `budgets-create-${fixture.transport.id}-GTQ`),
    ).toBe(false);
  });
});

describe('refresh', () => {
  it('reflects a new expense after coming back to the screen', async () => {
    const fixture = await seed();
    const budget = await repos().budgets.create({
      categoryId: fixture.food.id,
      amountMinor: 100000,
      currency: 'GTQ',
    });
    const view = await open();
    expect(label(view, `budget-${budget.id}-summary`)).toContain(
      `gastado ${money(0)}`,
    );

    // Leave and come back: the edit form, then back without saving.
    await pressByTestId(view.root, `budget-${budget.id}-edit`);
    await repos().transactions.create(expense(fixture, fixture.food.id, 85000));
    await typeByTestId(view.root, 'budget-amount', '1000');
    await pressByTestId(view.root, 'budget-submit');

    expect(label(view, `budget-${budget.id}-summary`)).toContain(
      `gastado ${money(85000)} de ${money(100000)}`,
    );
    expect(hasText(view, 'Por acercarse al límite')).toBe(true);
  });
});
