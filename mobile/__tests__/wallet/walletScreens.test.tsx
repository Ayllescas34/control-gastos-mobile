import type { InitialState } from '@react-navigation/native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
} from '../../src/features/accounts';
import { createTransactionRepository } from '../../src/features/transactions';
import {
  createWalletCaptureRepository,
  importWalletNotifications,
} from '../../src/features/wallet';
import {
  chooseAlertButton,
  spyOnAlerts,
} from '../../src/shared/testing/alerts';
import {
  flushAsync,
  hasText,
  pressByTestId,
} from '../../src/shared/testing/testRenderer';

const WALLET: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'Wallet' }],
};
const HOME: InitialState = { routes: [{ name: 'MainTabs' }] };

let database: Database;
let renderer: Renderer | null;
let credit: Account;

async function open(state: InitialState): Promise<Renderer> {
  renderer = await renderRootStack(database, state);
  await flushAsync();
  return renderer;
}

function notification(id: string, title: string, text: string) {
  return {
    id,
    packageName: 'com.google.android.apps.walletnfcrel',
    title,
    text,
    bigText: null,
    postedAt: Date.now(),
  };
}

beforeEach(async () => {
  database = await createTestDatabase();
  renderer = null;
  credit = await createAccountRepository(database.db).create({
    name: 'Visa oro',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  await createCardRepository(database.db).create({
    accountId: credit.id,
    alias: 'Visa',
    last4: '4242',
    network: 'visa',
  });
});

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await ReactTestRenderer.act(async () => {
      mounted.unmount();
    });
  }
  await database.close();
  jest.restoreAllMocks();
});

describe('Google Wallet screen', () => {
  it('lists unmatched payments and automatic movements waiting for review', async () => {
    await importWalletNotifications(database, [
      notification('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
      notification('n2', 'Tienda', 'Q10.00 con Visa •••• 0000'),
    ]);
    const view = await open(WALLET);

    expect(hasText(view, 'Por registrar')).toBe(true);
    expect(hasText(view, 'Tienda')).toBe(true);
    expect(hasText(view, 'Registrados automáticamente')).toBe(true);
    expect(hasText(view, 'Starbucks')).toBe(true);
  });

  it('dismisses a payment after confirmation', async () => {
    await importWalletNotifications(database, [
      notification('n2', 'Tienda', 'Q10.00'),
    ]);
    const [capture] = await createWalletCaptureRepository(
      database.db,
    ).listNew();
    const { lastButtons } = spyOnAlerts();
    const view = await open(WALLET);

    await pressByTestId(view.root, `wallet-capture-dismiss-${capture.id}`);
    await chooseAlertButton(lastButtons(), 'Descartar');

    expect(hasText(view, 'Tienda')).toBe(false);
    expect(
      (await createWalletCaptureRepository(database.db).getById(capture.id))
        ?.status,
    ).toBe('dismissed');
  });

  it('registers a payment through the prefilled movement form', async () => {
    await importWalletNotifications(database, [
      notification('n2', 'Tienda', 'Q10.00'),
    ]);
    const [capture] = await createWalletCaptureRepository(
      database.db,
    ).listNew();
    const view = await open(WALLET);

    await pressByTestId(view.root, `wallet-capture-register-${capture.id}`);
    expect(hasText(view, 'Pago capturado de Google Wallet')).toBe(true);
    await pressByTestId(view.root, 'transaction-submit');

    const [movement] = await createTransactionRepository(database.db).list();
    expect(movement).toMatchObject({
      amountMinor: 1000,
      accountId: credit.id,
      payee: 'Tienda',
      source: 'notification',
      status: 'confirmed',
    });
  });

  it('confirms an automatic movement from its detail', async () => {
    await importWalletNotifications(database, [
      notification('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
    ]);
    const transactions = createTransactionRepository(database.db);
    const [movement] = await transactions.list();
    const view = await open({
      routes: [
        { name: 'MainTabs' },
        { name: 'TransactionDetail', params: { transactionId: movement.id } },
      ],
    });

    expect(hasText(view, 'Por revisar')).toBe(true);
    await pressByTestId(view.root, 'transaction-confirm');

    expect((await transactions.getById(movement.id))?.status).toBe(
      'confirmed',
    );
    expect(hasText(view, 'Por revisar')).toBe(false);
  });
});

describe('Inicio as a wallet', () => {
  it('shows each active account as a card with its balance', async () => {
    const view = await open(HOME);
    expect(
      view.root.findAll(node => node.props.testID === `wallet-card-${credit.id}`)
        .length,
    ).toBeGreaterThan(0);
    expect(hasText(view, 'Tus tarjetas')).toBe(true);
  });
});
