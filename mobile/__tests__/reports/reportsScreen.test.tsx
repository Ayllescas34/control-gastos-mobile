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
import { formatPeriodLabel } from '../../src/features/dashboard/components/dashboardPresentation';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../src/features/transactions';
import { monthRange, todayLocalDate } from '../../src/shared/lib/dates';
import { formatMoney } from '../../src/shared/lib/money';
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
});

const REPORTS: InitialState = {
  routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Reports' }] } }],
};

async function open(db: Database = database) {
  renderer = await renderRootStack(db, REPORTS);
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
  dollars: Account;
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
  const dollars = await accounts.create({
    name: 'Dólares',
    type: 'bank',
    currency: 'USD',
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
    dollars,
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
  const localDate = fields.localDate ?? todayLocalDate();
  return {
    type: 'expense',
    amountMinor: 1000,
    currency: 'GTQ',
    accountId: fixture.bank.id,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    occurredAt: `${localDate}T12:00:00.000Z`,
    localDate,
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
const monthLabel = (monthsAgo: number) =>
  formatPeriodLabel(monthRange(new Date(), monthsAgo).from);

describe('Reportes states', () => {
  it('shows the current month and a loading state until SQLite answers', async () => {
    const view = await open(gatedDatabase);

    expect(label(view, 'reports-month')).toBe(
      `Reporte de ${monthLabel(0)}, mes actual`,
    );
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando el reporte',
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'Sin movimientos')).toBe(true);
  });

  it('shows a recoverable error without internal details', async () => {
    databaseClosed = true;
    await database.close();

    const view = await open();

    expect(hasText(view, 'No se pudo cargar el reporte')).toBe(true);
    expect(hasText(view, 'SQL')).toBe(false);
    expect(canPress(view.root, 'reports-retry')).toBe(true);
    // The month can still be changed.
    expect(canPress(view.root, 'reports-previous-month')).toBe(true);
  });

  it('shows an empty month without demo figures', async () => {
    await seedAccounts();

    const view = await open();

    expect(hasText(view, 'No hay ingresos ni gastos registrados')).toBe(true);
    expect(hasText(view, 'Gastos por categoría')).toBe(false);
    expect(hasText(view, 'Datos de demostración')).toBe(false);
  });

  it('treats a month with only transfers as a month without income or expenses', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, { type: 'transfer', toAccountId: fixture.savings.id }),
    );

    const view = await open();

    expect(hasText(view, 'No hay ingresos ni gastos registrados')).toBe(true);
  });
});

describe('Reportes figures', () => {
  it('summarizes the month: income, expenses, net balance and counts', async () => {
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
    // A card purchase is an expense; paying the card is a transfer, not a second expense.
    await transactions.create(
      movement(fixture, {
        accountId: fixture.credit.id,
        cardId: fixture.visa.id,
        amountMinor: 20000,
        categoryId: fixture.food.id,
      }),
    );
    await transactions.create(
      movement(fixture, {
        type: 'transfer',
        toAccountId: fixture.credit.id,
        amountMinor: 20000,
      }),
    );
    const archived = await transactions.create(
      movement(fixture, { amountMinor: 99999 }),
    );
    await transactions.softDelete(archived.id);

    const view = await open();

    expect(label(view, 'reports-income-GTQ')).toBe(
      `Ingresos: ${money(500000)}, 1 movimiento`,
    );
    expect(label(view, 'reports-expense-GTQ')).toBe(
      `Gastos: ${money(65075)}, 2 movimientos`,
    );
    expect(label(view, 'reports-net-GTQ')).toBe(
      `Balance del mes: ${money(434925)}`,
    );
  });

  it('shows a negative balance and no income when the month only has expenses', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, { amountMinor: 30000, categoryId: fixture.food.id }),
    );

    const view = await open();

    expect(label(view, 'reports-income-GTQ')).toBe(
      `Ingresos: ${money(0)}, Sin movimientos`,
    );
    expect(label(view, 'reports-net-GTQ')).toBe(
      `Balance del mes: ${money(-30000)}`,
    );
  });

  it('shows no categories when the month only has income', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, {
        type: 'income',
        amountMinor: 500000,
        categoryId: fixture.salary.id,
      }),
    );

    const view = await open();

    expect(hasText(view, 'Sin gastos en este mes.')).toBe(true);
    expect(testIds(view, 'reports-category-')).toEqual([]);
    expect(label(view, 'reports-expense-GTQ')).toBe(
      `Gastos: ${money(0)}, Sin movimientos`,
    );
  });

  it('lists categories largest first with their share, archived ones included', async () => {
    const fixture = await seedAccounts();
    const { transactions, categories } = repos();
    await transactions.create(
      movement(fixture, {
        amountMinor: 7500,
        categoryId: fixture.groceries.id,
      }),
    );
    await transactions.create(
      movement(fixture, { amountMinor: 2500, categoryId: fixture.food.id }),
    );
    await categories.softDelete(fixture.food.id);

    const view = await open();

    expect(testIds(view, 'reports-category-')).toEqual([
      `reports-category-${fixture.groceries.id}-GTQ`,
      `reports-category-${fixture.food.id}-GTQ`,
    ]);
    expect(label(view, `reports-category-${fixture.groceries.id}-GTQ`)).toMatch(
      /^Supermercado, .+, 75\s?% de tus gastos$/,
    );
    expect(label(view, `reports-category-${fixture.food.id}-GTQ`)).toMatch(
      /^Alimentación, .+, 25\s?% de tus gastos · Archivada$/,
    );
  });

  it('draws the daily activity with an accessible description', async () => {
    const fixture = await seedAccounts();
    const today = todayLocalDate();
    await repos().transactions.create(movement(fixture, { amountMinor: 1500 }));

    const view = await open();

    expect(testIds(view, 'reports-evolution-expense-')).toEqual([
      `reports-evolution-expense-${today}`,
    ]);
    expect(testIds(view, 'reports-evolution-income-')).toEqual([]);
    expect(label(view, 'reports-evolution-GTQ')).toBe(
      `Evolución de ingresos y gastos del mes, ${monthLabel(
        0,
      )}: 1 día con movimientos, ingresos ${money(0)}, gastos ${money(1500)}.`,
    );
  });

  it('keeps each currency separate', async () => {
    const fixture = await seedAccounts();
    const { transactions } = repos();
    await transactions.create(movement(fixture, { amountMinor: 1000 }));
    await transactions.create(
      movement(fixture, {
        currency: 'USD',
        accountId: fixture.dollars.id,
        amountMinor: 2000,
      }),
    );

    const view = await open();

    expect(label(view, 'reports-expense-GTQ')).toBe(
      `Gastos: ${money(1000)}, 1 movimiento`,
    );
    expect(label(view, 'reports-expense-USD')).toBe(
      `Gastos: ${formatMoney(2000, 'USD')}, 1 movimiento`,
    );
    expect(hasText(view, 'USD')).toBe(true);
  });
});

describe('Reportes month selector', () => {
  it('moves between months, never into the future, and back to the current one', async () => {
    const fixture = await seedAccounts();
    const previous = monthRange(new Date(), 1);
    await repos().transactions.create(
      movement(fixture, { amountMinor: 4200, localDate: previous.to }),
    );

    const view = await open();
    expect(canPress(view.root, 'reports-next-month')).toBe(false);
    expect(canPress(view.root, 'reports-current-month')).toBe(false);
    expect(hasText(view, 'No hay ingresos ni gastos registrados')).toBe(true);

    await pressByTestId(view.root, 'reports-previous-month');
    expect(label(view, 'reports-month')).toBe(`Reporte de ${monthLabel(1)}`);
    expect(label(view, 'reports-expense-GTQ')).toBe(
      `Gastos: ${money(4200)}, 1 movimiento`,
    );
    expect(canPress(view.root, 'reports-next-month')).toBe(true);

    await pressByTestId(view.root, 'reports-previous-month');
    expect(label(view, 'reports-month')).toBe(`Reporte de ${monthLabel(2)}`);
    expect(hasText(view, 'No hay ingresos ni gastos registrados')).toBe(true);

    await pressByTestId(view.root, 'reports-next-month');
    expect(label(view, 'reports-month')).toBe(`Reporte de ${monthLabel(1)}`);

    await pressByTestId(view.root, 'reports-current-month');
    expect(label(view, 'reports-month')).toBe(
      `Reporte de ${monthLabel(0)}, mes actual`,
    );
    expect(canPress(view.root, 'reports-next-month')).toBe(false);
    expect(hasText(view, 'No hay ingresos ni gastos registrados')).toBe(true);
  });
});
