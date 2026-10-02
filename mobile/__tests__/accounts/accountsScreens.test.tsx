/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { Alert, type AlertButton } from 'react-native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import type { InitialState } from '@react-navigation/native';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import {
  createDatabase,
  prepareDatabase,
  type Database,
} from '../../src/core/db';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
} from '../../src/features/accounts';
import { formatMoney } from '../../src/shared/lib/money';
import {
  canPress,
  flushAsync,
  hasText,
  inputValue,
  pressByTestId,
  typeByTestId,
} from '../../src/shared/testing/testRenderer';

/**
 * A real in-memory SQLite database whose queries can be held back, to observe loading
 * states. `release()` lets every pending and future query run.
 */
async function createDatabases() {
  const connection = new DatabaseSync(':memory:');
  const executor = createNodeSqliteExecutor(connection);
  const database = await prepareDatabase(createDatabase(executor));

  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const slow = createDatabase({
    execute: async (sql, params) => {
      await gate;
      return executor.execute(sql, params);
    },
    close: async () => {},
  });
  return { database, slow, release };
}

let database: Database;
let slowDatabase: Database;
let releaseQueries: () => void;
let databaseClosed: boolean;
let renderer: Renderer | null;

beforeEach(async () => {
  ({
    database,
    slow: slowDatabase,
    release: releaseQueries,
  } = await createDatabases());
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

function root(): ReactTestRenderer.ReactTestInstance {
  if (!renderer) {
    throw new Error('Nothing rendered');
  }
  return renderer.root;
}

const repositories = () => ({
  accounts: createAccountRepository(database.db),
  cards: createCardRepository(database.db),
});

function createBank(name = 'Banco Industrial'): Promise<Account> {
  return repositories().accounts.create({
    name,
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 1250050,
  });
}

/** Captures Alert.alert calls; returns the buttons of the last one. */
function spyOnAlerts() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const lastButtons = (): AlertButton[] =>
    (alert.mock.calls.at(-1)?.[2] as AlertButton[] | undefined) ?? [];
  return { alert, lastButtons };
}

async function choose(buttons: AlertButton[], text: string) {
  const button = buttons.find(candidate => candidate.text === text);
  if (!button) {
    throw new Error(`No "${text}" button`);
  }
  await ReactTestRenderer.act(async () => {
    button.onPress?.();
  });
  await flushAsync();
}

const ACCOUNTS: InitialState = { routes: [{ name: 'Accounts' }] };

describe('AccountsScreen', () => {
  it('shows a loading state until SQLite answers', async () => {
    const view = await open(ACCOUNTS, slowDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando cuentas',
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'No tienes cuentas todavía')).toBe(true);
  });

  it('shows the empty state of a new install, with no demo data', async () => {
    const view = await open(ACCOUNTS);

    expect(hasText(view, 'No tienes cuentas todavía')).toBe(true);
    expect(canPress(view.root, 'accounts-empty-add')).toBe(true);
    expect(await repositories().accounts.list()).toEqual([]);
  });

  it('lists persisted accounts and cards, showing only the last four digits', async () => {
    const bank = await createBank();
    await repositories().cards.create({
      accountId: bank.id,
      alias: 'Débito nómina',
      last4: '4242',
      network: 'visa',
    });

    const view = await open(ACCOUNTS);

    expect(hasText(view, 'Banco Industrial')).toBe(true);
    expect(hasText(view, 'Banco · GTQ')).toBe(true);
    expect(hasText(view, formatMoney(1250050, 'GTQ'))).toBe(true);
    expect(hasText(view, 'Débito nómina')).toBe(true);
    expect(hasText(view, '•••• 4242 · Banco Industrial')).toBe(true);
  });

  it('shows an empty cards section when there are accounts but no cards', async () => {
    await createBank();
    const view = await open(ACCOUNTS);

    expect(hasText(view, 'Aún no tienes tarjetas.')).toBe(true);
    expect(canPress(view.root, 'accounts-add-card')).toBe(true);
  });

  it('shows an error with a retry action when reading fails', async () => {
    databaseClosed = true;
    await database.close();

    const view = await open(ACCOUNTS);

    expect(hasText(view, 'No se pudieron cargar tus cuentas')).toBe(true);
    expect(canPress(view.root, 'accounts-retry')).toBe(true);
  });

  it('opens the detail of an account', async () => {
    const bank = await createBank();
    const view = await open(ACCOUNTS);

    await pressByTestId(view.root, `account-${bank.id}`);

    expect(hasText(view, 'Saldo inicial')).toBe(true);
    expect(hasText(view, 'Esta cuenta no tiene tarjetas.')).toBe(true);
  });

  it('is reached from Settings', async () => {
    const view = await open({
      routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Settings' }] } }],
    });

    await pressByTestId(view.root, 'settings-accounts');

    expect(hasText(view, 'No tienes cuentas todavía')).toBe(true);
  });
});

describe('account form', () => {
  it('validates before saving and writes nothing', async () => {
    const view = await open({ routes: [{ name: 'AccountForm' }] });

    await pressByTestId(view.root, 'account-submit');

    expect(hasText(view, 'Escribe un nombre para la cuenta.')).toBe(true);
    expect(hasText(view, 'Elige el tipo de cuenta.')).toBe(true);
    expect(await repositories().accounts.list()).toEqual([]);
  });

  it('rejects an amount with too many decimals', async () => {
    const view = await open({ routes: [{ name: 'AccountForm' }] });

    await typeByTestId(view.root, 'account-name', 'Efectivo');
    await pressByTestId(view.root, 'account-type-cash');
    await typeByTestId(view.root, 'account-initial-balance', '10.555');
    await pressByTestId(view.root, 'account-submit');

    expect(hasText(view, 'Usa como máximo 2 decimales.')).toBe(true);
    expect(await repositories().accounts.list()).toEqual([]);
  });

  it('creates an account in SQLite and returns to the list', async () => {
    const view = await open(ACCOUNTS);
    await pressByTestId(view.root, 'accounts-empty-add');

    await typeByTestId(view.root, 'account-name', '  Banco Industrial  ');
    await pressByTestId(view.root, 'account-type-bank');
    await typeByTestId(view.root, 'account-initial-balance', '12,500.50');
    await pressByTestId(view.root, 'account-submit');

    // Persisted: a fresh repository reads it from SQLite, in exact minor units.
    expect(await repositories().accounts.list()).toEqual([
      expect.objectContaining({
        name: 'Banco Industrial',
        type: 'bank',
        currency: 'GTQ',
        initialBalanceMinor: 1250050,
      }),
    ]);
    // Back on the list, refreshed on focus.
    expect(hasText(view, 'Banco · GTQ')).toBe(true);
  });

  it('shows the saving state and blocks a second submit', async () => {
    const view = await open(
      { routes: [{ name: 'Accounts' }, { name: 'AccountForm' }] },
      slowDatabase,
    );
    await typeByTestId(view.root, 'account-name', 'Ahorro');
    await pressByTestId(view.root, 'account-type-savings');

    // Two taps before React re-renders: only one save may run.
    const [submit] = view.root.findAll(
      node =>
        node.props.testID === 'account-submit' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      submit.props.onPress();
      submit.props.onPress();
    });

    expect(canPress(view.root, 'account-submit')).toBe(false);
    expect(
      view.root.findAll(
        node =>
          node.props.testID === 'account-submit' &&
          node.props.accessibilityState?.busy === true,
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(await repositories().accounts.list()).toHaveLength(1);
  });

  it('edits an account; the currency is not editable', async () => {
    const bank = await createBank('Banco');
    const view = await open({
      routes: [
        { name: 'Accounts' },
        { name: 'AccountDetail', params: { accountId: bank.id } },
      ],
    });

    await pressByTestId(view.root, 'account-edit');
    expect(inputValue(view.root, 'account-name')).toBe('Banco');
    expect(inputValue(view.root, 'account-initial-balance')).toBe('12500.50');
    expect(
      view.root.findAll(
        node =>
          node.props.testID === 'account-currency' &&
          node.props.editable === false,
      ).length,
    ).toBeGreaterThan(0);

    await typeByTestId(view.root, 'account-name', 'Banco principal');
    await pressByTestId(view.root, 'account-submit');

    expect((await repositories().accounts.getById(bank.id))?.name).toBe(
      'Banco principal',
    );
    // Back on the detail, refreshed.
    expect(hasText(view, 'Banco principal')).toBe(true);
    expect(hasText(view, 'Saldo inicial')).toBe(true);
  });
});

describe('card form', () => {
  it('asks to create an account first when there is none', async () => {
    const view = await open({ routes: [{ name: 'CardForm' }] });
    expect(hasText(view, 'Primero crea una cuenta')).toBe(true);
  });

  it('accepts only four digits and validates before saving', async () => {
    const bank = await createBank();
    const view = await open({
      routes: [{ name: 'CardForm', params: { accountId: bank.id } }],
    });

    await typeByTestId(view.root, 'card-last4', '4111 1111 1111 1111');
    expect(inputValue(view.root, 'card-last4')).toBe('4111');

    await typeByTestId(view.root, 'card-last4', '12');
    await pressByTestId(view.root, 'card-submit');

    expect(
      hasText(view, 'Escribe solo los últimos 4 dígitos de la tarjeta.'),
    ).toBe(true);
    expect(
      hasText(view, 'Escribe un nombre para identificar la tarjeta.'),
    ).toBe(true);
    expect(await repositories().cards.list()).toEqual([]);
  });

  it('creates a card for the account it was opened from', async () => {
    const bank = await createBank();
    const view = await open({
      routes: [
        { name: 'Accounts' },
        { name: 'AccountDetail', params: { accountId: bank.id } },
      ],
    });

    await pressByTestId(view.root, 'account-add-card');
    await typeByTestId(view.root, 'card-alias', 'Débito nómina');
    await typeByTestId(view.root, 'card-last4', '0042');
    await pressByTestId(view.root, 'card-network-mastercard');
    await pressByTestId(view.root, 'card-submit');

    expect(await repositories().cards.listByAccount(bank.id)).toEqual([
      expect.objectContaining({
        alias: 'Débito nómina',
        last4: '0042',
        network: 'mastercard',
      }),
    ]);
    // Back on the account detail, which now lists the card.
    expect(hasText(view, 'Débito nómina')).toBe(true);
    expect(hasText(view, '•••• 0042')).toBe(true);
  });

  it('edits a card; its account is shown but cannot change', async () => {
    const bank = await createBank();
    const card = await repositories().cards.create({
      accountId: bank.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
    const view = await open({
      routes: [
        { name: 'Accounts' },
        { name: 'CardDetail', params: { cardId: card.id } },
      ],
    });

    await pressByTestId(view.root, 'card-edit');
    expect(inputValue(view.root, 'card-account-locked')).toBe(
      'Banco Industrial',
    );
    expect(canPress(view.root, `card-account-${bank.id}`)).toBe(false);

    await typeByTestId(view.root, 'card-alias', 'Visa oro');
    await pressByTestId(view.root, 'card-network-none');
    await pressByTestId(view.root, 'card-submit');

    expect(await repositories().cards.getById(card.id)).toMatchObject({
      alias: 'Visa oro',
      network: null,
      accountId: bank.id,
    });
    expect(hasText(view, 'Visa oro')).toBe(true);
  });
});

describe('archiving', () => {
  async function seedCard() {
    const bank = await createBank();
    const card = await repositories().cards.create({
      accountId: bank.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
    return { bank, card };
  }

  it('archives a card after confirmation', async () => {
    const { card } = await seedCard();
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open({
      routes: [
        { name: 'Accounts' },
        { name: 'CardDetail', params: { cardId: card.id } },
      ],
    });

    await pressByTestId(view.root, 'card-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Archivar tarjeta?',
      expect.stringContaining('dejará de aparecer'),
      expect.any(Array),
    );
    expect(await repositories().cards.getById(card.id)).not.toBeNull();

    await choose(lastButtons(), 'Archivar');

    expect(await repositories().cards.list()).toEqual([]);
    // Back on the list, which no longer shows it.
    expect(hasText(view, 'Aún no tienes tarjetas.')).toBe(true);
  });

  it('keeps the card when the confirmation is cancelled', async () => {
    const { card } = await seedCard();
    const { lastButtons } = spyOnAlerts();
    const view = await open({
      routes: [{ name: 'CardDetail', params: { cardId: card.id } }],
    });

    await pressByTestId(view.root, 'card-archive');
    await choose(lastButtons(), 'Cancelar');

    expect(await repositories().cards.getById(card.id)).not.toBeNull();
  });

  it('does not archive an account with active cards and explains why', async () => {
    const { bank } = await seedCard();
    const { alert } = spyOnAlerts();
    const view = await open({
      routes: [{ name: 'AccountDetail', params: { accountId: bank.id } }],
    });

    await pressByTestId(view.root, 'account-archive');

    expect(alert).toHaveBeenCalledWith(
      'No se puede archivar',
      'Esta cuenta tiene tarjetas activas. Archiva primero sus tarjetas.',
    );
    expect(await repositories().accounts.getById(bank.id)).not.toBeNull();
  });

  it('archives an account after confirmation and leaves the active list', async () => {
    const bank = await createBank();
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open({
      routes: [
        { name: 'Accounts' },
        { name: 'AccountDetail', params: { accountId: bank.id } },
      ],
    });

    await pressByTestId(view.root, 'account-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Archivar cuenta?',
      expect.stringContaining('Banco Industrial'),
      expect.any(Array),
    );
    await choose(lastButtons(), 'Archivar');

    expect(await repositories().accounts.list()).toEqual([]);
    expect(hasText(view, 'No tienes cuentas todavía')).toBe(true);
  });

  it('reports a failed archive instead of hiding it', async () => {
    const bank = await createBank();
    const { alert, lastButtons } = spyOnAlerts();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await open({
      routes: [{ name: 'AccountDetail', params: { accountId: bank.id } }],
    });

    await pressByTestId(root(), 'account-archive');
    // The database becomes unavailable before the user confirms.
    databaseClosed = true;
    await database.close();
    await choose(lastButtons(), 'Archivar');

    expect(alert).toHaveBeenLastCalledWith(
      'No se pudo archivar la cuenta',
      'Ocurrió un error al acceder a tus datos. Inténtalo de nuevo.',
    );
    expect(consoleError).toHaveBeenCalled();
  });
});
