import type { InitialState } from '@react-navigation/native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import type { Database } from '../../src/core/db';
import { createGatedTestDatabase } from '../../src/core/db/testing/createGatedTestDatabase';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import {
  createCategoryRepository,
  type Category,
} from '../../src/features/categories';
import { RECENT_TRANSACTIONS_LIMIT } from '../../src/features/dashboard/hooks/useDashboard';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../src/features/transactions';
import {
  localDateDaysBefore,
  monthRange,
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
  pressByTestId,
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

const INICIO: InitialState = { routes: [{ name: 'MainTabs' }] };

async function open(db: Database = database) {
  renderer = await renderRootStack(db, INICIO);
  await flushAsync();
  return renderer;
}

const repos = () => ({
  accounts: createAccountRepository(database.db),
  cards: createCardRepository(database.db),
  categories: createCategoryRepository(database.db),
  transactions: createTransactionRepository(database.db),
});

type Fixture = {
  bank: Account;
  savings: Account;
  credit: Account;
  visa: Card;
  groceries: Category;
  food: Category;
  salary: Category;
};

async function seedAccounts(): Promise<Fixture> {
  const { accounts, cards, categories } = repos();
  const bank = await accounts.create({
    name: 'Banco Industrial',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 100000,
  });
  const savings = await accounts.create({
    name: 'Ahorro',
    type: 'savings',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  const credit = await accounts.create({
    name: 'Visa Oro',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  const visa = await cards.create({
    accountId: credit.id,
    alias: 'Visa',
    last4: '4242',
    network: 'visa',
  });
  const all = await categories.list();
  const named = (name: string) => all.find(c => c.name === name)!;
  return {
    bank,
    savings,
    credit,
    visa,
    groceries: named('Supermercado'),
    food: named('Alimentación'),
    salary: named('Salario'),
  };
}

function movement(
  fixture: Fixture,
  fields: Partial<NewTransaction>,
): NewTransaction {
  return {
    type: 'expense',
    amountMinor: 1000,
    currency: 'GTQ',
    accountId: fixture.bank.id,
    toAccountId: null,
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
    ...fields,
  };
}

/** The accessibility label of the element with `testID` (what a screen reader announces). */
function label(view: Renderer, testID: string): string | undefined {
  return view.root.findAll(
    node => node.props.testID === testID && node.props.accessibilityLabel,
  )[0]?.props.accessibilityLabel;
}

/** testIDs rendered with `prefix`, in screen order and without duplicates. */
function testIds(view: Renderer, prefix: string): string[] {
  const ids = view.root
    .findAll(
      node =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith(prefix),
    )
    .map(node => node.props.testID as string);
  return [...new Set(ids)];
}

const money = (amountMinor: number) => formatMoney(amountMinor, 'GTQ');

describe('Inicio states', () => {
  it('shows an empty state on a new install, with no demo figures', async () => {
    const view = await open();

    expect(hasText(view, 'Tu resumen está vacío')).toBe(true);
    expect(hasText(view, 'Datos de demostración')).toBe(false);
    expect(hasText(view, 'Balance total')).toBe(false);
    expect(canPress(view.root, 'dashboard-empty-add-account')).toBe(true);
  });

  it('shows a loading state until SQLite answers', async () => {
    const view = await open(gatedDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando tu resumen',
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'Tu resumen está vacío')).toBe(true);
  });

  it('shows an error without internal details and a retry action', async () => {
    databaseClosed = true;
    await database.close();

    const view = await open();

    expect(hasText(view, 'No se pudo cargar tu resumen')).toBe(true);
    expect(hasText(view, 'SQL')).toBe(false);
    expect(canPress(view.root, 'dashboard-retry')).toBe(true);
  });

  it('shows real zeros for an account without movements', async () => {
    await seedAccounts();

    const view = await open();

    expect(label(view, 'dashboard-balance-GTQ')).toBe(
      `Balance total: ${money(100000)}`,
    );
    expect(label(view, 'dashboard-income-GTQ')).toBe(
      `Ingresos del mes: ${money(0)}`,
    );
    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(0)}`,
    );
    expect(hasText(view, 'Sin ingresos ni gastos este mes.')).toBe(true);
    expect(hasText(view, 'Sin gastos este mes.')).toBe(true);
    expect(hasText(view, 'Aún no tienes movimientos')).toBe(true);
  });
});

describe('Inicio figures', () => {
  it('uses the accounts balance and counts only income and expenses of the month', async () => {
    const fixture = await seedAccounts();
    const { transactions } = repos();
    await transactions.create(
      movement(fixture, {
        type: 'income',
        amountMinor: 500000,
        categoryId: fixture.salary.id,
      }),
    );
    await transactions.create(
      movement(fixture, {
        amountMinor: 45075,
        categoryId: fixture.groceries.id,
      }),
    );
    // Transfer between own accounts: neither income nor expense.
    await transactions.create(
      movement(fixture, {
        type: 'transfer',
        amountMinor: 100000,
        toAccountId: fixture.savings.id,
      }),
    );
    // Credit card purchase, then its payment: one expense only.
    await transactions.create(
      movement(fixture, {
        amountMinor: 20000,
        accountId: fixture.credit.id,
        cardId: fixture.visa.id,
        categoryId: fixture.groceries.id,
      }),
    );
    await transactions.create(
      movement(fixture, {
        type: 'transfer',
        amountMinor: 20000,
        toAccountId: fixture.credit.id,
      }),
    );

    const view = await open();

    // Bank 100000 + 500000 - 45075 - 100000 - 20000; savings 100000; credit 0.
    expect(label(view, 'dashboard-balance-GTQ')).toBe(
      `Balance total: ${money(534925)}`,
    );
    expect(label(view, 'dashboard-income-GTQ')).toBe(
      `Ingresos del mes: ${money(500000)}`,
    );
    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(65075)}`,
    );
  });

  it('counts only the current month in totals but keeps the balance whole', async () => {
    const fixture = await seedAccounts();
    const lastMonth = localDateDaysBefore(monthRange(new Date()).from, 1);
    await repos().transactions.create(
      movement(fixture, {
        amountMinor: 30000,
        localDate: lastMonth,
        payee: 'Mes anterior',
      }),
    );

    const view = await open();

    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(0)}`,
    );
    expect(label(view, 'dashboard-balance-GTQ')).toBe(
      `Balance total: ${money(70000)}`,
    );
    expect(hasText(view, 'Mes anterior')).toBe(true);
  });

  it('ignores archived movements', async () => {
    const fixture = await seedAccounts();
    const { transactions } = repos();
    const archived = await transactions.create(
      movement(fixture, { amountMinor: 9900, payee: 'Archivado' }),
    );
    await transactions.softDelete(archived.id);

    const view = await open();

    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(0)}`,
    );
    expect(label(view, 'dashboard-balance-GTQ')).toBe(
      `Balance total: ${money(100000)}`,
    );
    expect(hasText(view, 'Archivado')).toBe(false);
  });

  it('groups expenses by category, largest first, with their share', async () => {
    const fixture = await seedAccounts();
    const { transactions } = repos();
    await transactions.create(
      movement(fixture, { amountMinor: 2500, categoryId: fixture.food.id }),
    );
    await transactions.create(
      movement(fixture, {
        amountMinor: 7500,
        categoryId: fixture.groceries.id,
      }),
    );
    await transactions.create(
      movement(fixture, {
        type: 'income',
        amountMinor: 90000,
        categoryId: fixture.salary.id,
      }),
    );

    const view = await open();

    expect(testIds(view, 'dashboard-category-')).toEqual([
      `dashboard-category-${fixture.groceries.id}-GTQ`,
      `dashboard-category-${fixture.food.id}-GTQ`,
    ]);
    expect(
      label(view, `dashboard-category-${fixture.groceries.id}-GTQ`),
    ).toContain(money(7500));
    const share = new Intl.NumberFormat('es-GT', { style: 'percent' }).format(
      0.75,
    );
    expect(hasText(view, `${share} de tus gastos`)).toBe(true);
  });

  it('keeps an archived category used by movements of the month', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, {
        amountMinor: 4000,
        categoryId: fixture.groceries.id,
      }),
    );
    await repos().categories.softDelete(fixture.groceries.id);

    const view = await open();

    expect(
      label(view, `dashboard-category-${fixture.groceries.id}-GTQ`),
    ).toContain('Supermercado');
    expect(hasText(view, 'Archivada')).toBe(true);
  });

  it('draws the evolution of the month from real days only', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(movement(fixture, { amountMinor: 1500 }));

    const view = await open();
    const today = todayLocalDate();

    expect(testIds(view, 'dashboard-evolution-expense-')).toEqual([
      `dashboard-evolution-expense-${today}`,
    ]);
    expect(testIds(view, 'dashboard-evolution-income-')).toEqual([]);
    expect(label(view, 'dashboard-evolution-GTQ')).toContain(
      'Evolución de ingresos y gastos del mes actual',
    );
  });
});

describe('Movimientos recientes', () => {
  it(`shows only the latest ${RECENT_TRANSACTIONS_LIMIT}, newest first`, async () => {
    const fixture = await seedAccounts();
    const today = todayLocalDate();
    const created = [];
    for (let day = 7; day >= 1; day--) {
      created.push(
        await repos().transactions.create(
          movement(fixture, {
            localDate: localDateDaysBefore(today, day),
            payee: `Compra ${day}`,
          }),
        ),
      );
    }

    const view = await open();

    const expected = created
      .slice(-RECENT_TRANSACTIONS_LIMIT)
      .reverse()
      .map(transaction => `transaction-${transaction.id}`);
    expect(testIds(view, 'transaction-')).toEqual(expected);
  });

  it('shows type, category, account and signed amount like Movimientos', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, {
        amountMinor: 45075,
        payee: 'La Torre',
        categoryId: fixture.groceries.id,
      }),
    );

    const view = await open();

    expect(hasText(view, 'La Torre')).toBe(true);
    expect(hasText(view, 'Supermercado · Banco Industrial')).toBe(true);
    expect(hasText(view, `−${money(45075)}`)).toBe(true);
  });
});

describe('refresh', () => {
  it('updates after archiving a movement and coming back', async () => {
    const fixture = await seedAccounts();
    const expense = await repos().transactions.create(
      movement(fixture, { amountMinor: 25000, payee: 'Gasolina' }),
    );
    const { lastButtons } = spyOnAlerts();
    const view = await open();
    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(25000)}`,
    );

    await pressByTestId(view.root, `transaction-${expense.id}`);
    await pressByTestId(view.root, 'transaction-archive');
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(label(view, 'dashboard-expense-GTQ')).toBe(
      `Gastos del mes: ${money(0)}`,
    );
    expect(label(view, 'dashboard-balance-GTQ')).toBe(
      `Balance total: ${money(100000)}`,
    );
    expect(hasText(view, 'Gasolina')).toBe(false);
  });
});
