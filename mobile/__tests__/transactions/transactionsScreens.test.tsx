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

async function open(state: InitialState, db: Database = database) {
  renderer = await renderRootStack(db, state);
  await flushAsync();
  return renderer;
}

/** Lets the search debounce fire, then the query resolve. */
async function waitForSearch() {
  await ReactTestRenderer.act(
    () => new Promise<void>(resolve => setTimeout(resolve, 350)),
  );
  await flushAsync();
}

const repos = () => ({
  accounts: createAccountRepository(database.db),
  cards: createCardRepository(database.db),
  categories: createCategoryRepository(database.db),
  transactions: createTransactionRepository(database.db),
});

const MOVEMENTS: InitialState = {
  routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Transactions' }] } }],
};

type Fixture = {
  bank: Account;
  credit: Account;
  debit: Card;
  visa: Card;
  groceries: Category;
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
  const credit = await accounts.create({
    name: 'Visa Oro',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  const debit = await cards.create({
    accountId: bank.id,
    alias: 'Débito',
    last4: '1111',
    network: 'mastercard',
  });
  const visa = await cards.create({
    accountId: credit.id,
    alias: 'Visa',
    last4: '4242',
    network: 'visa',
  });
  const all = await categories.list();
  const named = (name: string) => {
    const found = all.find(category => category.name === name);
    if (!found) {
      throw new Error(name);
    }
    return found;
  };
  return {
    bank,
    credit,
    debit,
    visa,
    groceries: named('Supermercado'),
    salary: named('Salario'),
  };
}

function movement(
  fixture: Fixture,
  fields: Partial<NewTransaction>,
): NewTransaction {
  const today = todayLocalDate();
  return {
    type: 'expense',
    amountMinor: 1000,
    currency: 'GTQ',
    accountId: fixture.bank.id,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    occurredAt: new Date().toISOString(),
    localDate: today,
    description: null,
    payee: null,
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
    ...fields,
  };
}

describe('Movimientos', () => {
  it('shows the empty state with no demo data', async () => {
    const view = await open(MOVEMENTS);

    expect(hasText(view, 'No tienes movimientos todavía')).toBe(true);
    expect(canPress(view.root, 'transactions-empty-add')).toBe(true);
  });

  it('shows a loading state until SQLite answers', async () => {
    const view = await open(MOVEMENTS, gatedDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando movimientos',
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'No tienes movimientos todavía')).toBe(true);
  });

  it('shows an error with a retry action when reading fails', async () => {
    databaseClosed = true;
    await database.close();

    const view = await open(MOVEMENTS);

    expect(hasText(view, 'No se pudieron cargar tus movimientos')).toBe(true);
    expect(canPress(view.root, 'transactions-retry')).toBe(true);
  });

  it('lists real movements by day with category, account and signed amount', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, {
        amountMinor: 45075,
        payee: 'La Torre',
        categoryId: fixture.groceries.id,
      }),
    );

    const view = await open(MOVEMENTS);

    expect(hasText(view, 'Hoy')).toBe(true);
    expect(hasText(view, 'La Torre')).toBe(true);
    expect(hasText(view, 'Supermercado · Banco Industrial')).toBe(true);
    expect(hasText(view, `−${formatMoney(45075, 'GTQ')}`)).toBe(true);
  });
});

describe('creating movements', () => {
  it('asks for an account first when there is none', async () => {
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'NewTransaction' }],
    });
    expect(hasText(view, 'Primero crea una cuenta')).toBe(true);
  });

  it('shows only the type choice until a type is chosen', async () => {
    await seedAccounts();
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'NewTransaction' }],
    });

    expect(hasText(view, 'Elige si registras un gasto')).toBe(true);
    expect(canPress(view.root, 'transaction-submit')).toBe(false);
  });

  it('validates before saving', async () => {
    await seedAccounts();
    const view = await open({
      routes: [
        { name: 'MainTabs' },
        { name: 'NewTransaction', params: { type: 'expense' } },
      ],
    });

    await pressByTestId(view.root, 'transaction-submit');

    expect(hasText(view, 'Escribe el monto.')).toBe(true);
    expect(hasText(view, 'Elige una cuenta.')).toBe(true);
    expect(await repos().transactions.list()).toEqual([]);
  });

  it('creates an expense paid with a card, in exact minor units', async () => {
    const fixture = await seedAccounts();
    const view = await open(MOVEMENTS);
    await pressByTestId(view.root, 'transactions-empty-add');

    await pressByTestId(view.root, 'transaction-type-expense');
    await typeByTestId(view.root, 'transaction-amount', '450.75');
    await pressByTestId(view.root, `transaction-account-${fixture.bank.id}`);
    await pressByTestId(
      view.root,
      `transaction-category-${fixture.groceries.id}`,
    );
    // Only the cards of the chosen account are offered.
    expect(canPress(view.root, `transaction-card-${fixture.visa.id}`)).toBe(
      false,
    );
    await pressByTestId(view.root, `transaction-card-${fixture.debit.id}`);
    await typeByTestId(view.root, 'transaction-payee', 'La Torre');
    await pressByTestId(view.root, 'transaction-submit');

    expect(await repos().transactions.list()).toEqual([
      expect.objectContaining({
        type: 'expense',
        amountMinor: 45075,
        currency: 'GTQ',
        accountId: fixture.bank.id,
        categoryId: fixture.groceries.id,
        cardId: fixture.debit.id,
        payee: 'La Torre',
        localDate: todayLocalDate(),
      }),
    ]);
    expect(hasText(view, 'La Torre')).toBe(true);
  });

  it('creates an income with an income category', async () => {
    const fixture = await seedAccounts();
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'NewTransaction' }],
    });

    await pressByTestId(view.root, 'transaction-type-income');
    // Expense categories are not offered for an income.
    expect(
      canPress(view.root, `transaction-category-${fixture.groceries.id}`),
    ).toBe(false);
    await typeByTestId(view.root, 'transaction-amount', '12,500');
    await pressByTestId(view.root, `transaction-account-${fixture.bank.id}`);
    await pressByTestId(view.root, `transaction-category-${fixture.salary.id}`);
    await pressByTestId(view.root, 'transaction-date-yesterday');
    await pressByTestId(view.root, 'transaction-submit');

    const [income] = await repos().transactions.list();
    expect(income).toMatchObject({
      type: 'income',
      amountMinor: 1250000,
      categoryId: fixture.salary.id,
      cardId: null,
    });
    expect(income.localDate).not.toBe(todayLocalDate());
  });

  it('pays a credit card with a transfer, never a second expense', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, {
        accountId: fixture.credit.id,
        cardId: fixture.visa.id,
        amountMinor: 30000,
      }),
    );
    const view = await open({
      routes: [{ name: 'MainTabs' }, { name: 'NewTransaction' }],
    });

    await pressByTestId(view.root, 'transaction-type-transfer');
    await typeByTestId(view.root, 'transaction-amount', '300');
    await pressByTestId(view.root, `transaction-account-${fixture.bank.id}`);
    // The origin is not offered as destination.
    expect(
      canPress(view.root, `transaction-to-account-${fixture.bank.id}`),
    ).toBe(false);
    await pressByTestId(
      view.root,
      `transaction-to-account-${fixture.credit.id}`,
    );
    expect(hasText(view, 'Pago de tarjeta de crédito')).toBe(true);
    await pressByTestId(view.root, 'transaction-submit');

    const { transactions } = repos();
    expect(await transactions.list({ type: 'expense' })).toHaveLength(1);
    expect(await transactions.list({ type: 'transfer' })).toEqual([
      expect.objectContaining({
        accountId: fixture.bank.id,
        toAccountId: fixture.credit.id,
        amountMinor: 30000,
        categoryId: null,
        cardId: null,
      }),
    ]);
    expect(await transactions.getAccountBalance(fixture.credit.id)).toBe(0);
  });
});

describe('detail, edit and archive', () => {
  async function seedExpense() {
    const fixture = await seedAccounts();
    const expense = await repos().transactions.create(
      movement(fixture, {
        amountMinor: 45075,
        payee: 'La Torre',
        description: 'Compra semanal',
        note: 'Con descuento',
        categoryId: fixture.groceries.id,
        cardId: fixture.debit.id,
      }),
    );
    return { fixture, expense };
  }

  it('shows every field of a movement', async () => {
    const { expense } = await seedExpense();
    const view = await open(MOVEMENTS);

    await pressByTestId(view.root, `transaction-${expense.id}`);

    for (const text of [
      'Gasto',
      'La Torre',
      'Banco Industrial',
      'Supermercado',
      'Débito •••• 1111',
      'Compra semanal',
      'Con descuento',
    ]) {
      expect(hasText(view, text)).toBe(true);
    }
  });

  it('edits a movement and shows the change', async () => {
    const { expense } = await seedExpense();
    const view = await open({
      routes: [
        { name: 'MainTabs' },
        { name: 'TransactionDetail', params: { transactionId: expense.id } },
      ],
    });

    await pressByTestId(view.root, 'transaction-edit');
    expect(inputValue(view.root, 'transaction-amount')).toBe('450.75');
    await typeByTestId(view.root, 'transaction-amount', '500');
    await pressByTestId(view.root, 'transaction-submit');

    expect(await repos().transactions.getById(expense.id)).toMatchObject({
      amountMinor: 50000,
      cardId: expense.cardId,
      occurredAt: expense.occurredAt,
    });
    expect(hasText(view, `−${formatMoney(50000, 'GTQ')}`)).toBe(true);
  });

  it('archives after confirmation and leaves the list', async () => {
    const { expense } = await seedExpense();
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open(MOVEMENTS);

    await pressByTestId(view.root, `transaction-${expense.id}`);
    await pressByTestId(view.root, 'transaction-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Archivar movimiento?',
      expect.stringContaining('saldos'),
      expect.any(Array),
    );
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(await repos().transactions.list()).toEqual([]);
    expect(hasText(view, 'No tienes movimientos todavía')).toBe(true);
  });
});

describe('search and filters', () => {
  async function seedMany() {
    const fixture = await seedAccounts();
    const { transactions } = repos();
    const market = await transactions.create(
      movement(fixture, {
        payee: 'La Torre',
        categoryId: fixture.groceries.id,
      }),
    );
    const salary = await transactions.create(
      movement(fixture, {
        type: 'income',
        amountMinor: 1250000,
        description: 'Salario',
        categoryId: fixture.salary.id,
      }),
    );
    const cardPurchase = await transactions.create(
      movement(fixture, {
        accountId: fixture.credit.id,
        cardId: fixture.visa.id,
        payee: 'Gasolinera',
      }),
    );
    return { fixture, market, salary, cardPurchase };
  }

  const shown = (view: Renderer, id: string) =>
    view.root.findAll(node => node.props.testID === `transaction-${id}`)
      .length > 0;

  it('searches through the repository', async () => {
    const { market, salary } = await seedMany();
    const view = await open(MOVEMENTS);

    await typeByTestId(view.root, 'transactions-search', 'torre');
    await waitForSearch();

    expect(shown(view, market.id)).toBe(true);
    expect(shown(view, salary.id)).toBe(false);

    await typeByTestId(view.root, 'transactions-search', 'nada que coincida');
    await waitForSearch();
    expect(hasText(view, 'No hay movimientos que coincidan')).toBe(true);
  });

  it('filters by type', async () => {
    const { market, salary } = await seedMany();
    const view = await open(MOVEMENTS);

    await pressByTestId(view.root, 'transactions-type-income');

    expect(shown(view, salary.id)).toBe(true);
    expect(shown(view, market.id)).toBe(false);
  });

  it('filters by account and category, and clears the filters', async () => {
    const { fixture, market, salary, cardPurchase } = await seedMany();
    const view = await open(MOVEMENTS);

    await pressByTestId(view.root, 'transactions-filters-toggle');
    await pressByTestId(view.root, `transactions-account-${fixture.credit.id}`);
    expect(shown(view, cardPurchase.id)).toBe(true);
    expect(shown(view, market.id)).toBe(false);
    expect(hasText(view, 'Más filtros (1)')).toBe(true);

    await pressByTestId(view.root, 'transactions-clear-filters');
    await pressByTestId(
      view.root,
      `transactions-category-${fixture.groceries.id}`,
    );
    expect(shown(view, market.id)).toBe(true);
    expect(shown(view, salary.id)).toBe(false);
    expect(shown(view, cardPurchase.id)).toBe(false);
  });

  it('filters by period', async () => {
    const { fixture, market } = await seedMany();
    const old = await repos().transactions.create(
      movement(fixture, {
        payee: 'Hace mucho',
        localDate: '2020-01-15',
        occurredAt: '2020-01-15T18:00:00.000Z',
      }),
    );
    const view = await open(MOVEMENTS);
    expect(shown(view, old.id)).toBe(true);

    await pressByTestId(view.root, 'transactions-filters-toggle');
    await pressByTestId(view.root, 'transactions-period-thisMonth');

    expect(shown(view, market.id)).toBe(true);
    expect(shown(view, old.id)).toBe(false);
  });
});

describe('Inicio', () => {
  it('shows the latest real movements under the demo summary', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, { payee: 'Movimiento real' }),
    );

    const view = await open({ routes: [{ name: 'MainTabs' }] });

    expect(hasText(view, 'Datos de demostración')).toBe(true);
    expect(hasText(view, 'Movimiento real')).toBe(true);
  });
});

describe('Cuentas', () => {
  it('shows balances derived from real movements', async () => {
    const fixture = await seedAccounts();
    await repos().transactions.create(
      movement(fixture, { amountMinor: 25000 }),
    );

    const view = await open({ routes: [{ name: 'Accounts' }] });

    expect(hasText(view, formatMoney(75000, 'GTQ'))).toBe(true);
  });
});
