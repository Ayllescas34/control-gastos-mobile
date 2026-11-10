import { sql } from 'drizzle-orm';
import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import type { RawWalletNotification } from '../../src/core/native/walletCaptures';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
} from '../../src/features/accounts';
import {
  createTransactionRepository,
  type TransactionRepository,
} from '../../src/features/transactions';
import {
  createWalletCaptureRepository,
  importWalletNotifications,
  registerWaitingCaptures,
} from '../../src/features/wallet';

const MESSAGES = 'com.google.android.apps.messaging';
const WALLET = 'com.google.android.apps.walletnfcrel';
// SMS arrive a few minutes after the movement; the bank's own time is used.
const RECEIVED = new Date(2026, 10, 7, 16, 0).getTime();

let database: Database;
let transactions: TransactionRepository;
let credit: Account;
let monetary: Account;
let cash: Account;

let counter = 0;
function sms(text: string, postedAt = RECEIVED): RawWalletNotification {
  counter += 1;
  return {
    id: `sms-${counter}`,
    packageName: MESSAGES,
    title: '2424',
    text,
    bigText: null,
    postedAt,
  };
}

const capturesWith = async (status: string) => {
  const [[count]] = await database.db.values<[number]>(
    sql`SELECT count(*) FROM wallet_captures WHERE status = ${status}`,
  );
  return count;
};

beforeEach(async () => {
  database = await createTestDatabase();
  const accounts = createAccountRepository(database.db);
  transactions = createTransactionRepository(database.db);
  credit = await accounts.create({
    name: 'BI Visa',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
    bankLabel: 'TCREDITO',
  });
  monetary = await accounts.create({
    name: 'BI Monetaria',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 100000,
    bankLabel: 'BICHEQUE3',
  });
  cash = await accounts.create({
    name: 'Efectivo',
    type: 'cash',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
});

afterEach(() => database.close());

describe('bank SMS (Banco Industrial)', () => {
  it('registers purchases on the account whose identifier the SMS names', async () => {
    const result = await importWalletNotifications(database, [
      sms(
        'BiMovil: Consumo por Q.52.70 en SUPER LA TORRE JOCOTENA Cuenta TCREDITO 07-Nov 14:26 Autorizacion 201038.',
      ),
      sms(
        'BiMovil: Consumo por Q.28.25 en SUPER LA TORRE JOCOTEN Cuenta BICHEQUE3 24-Oct 13:29 Autorizacion 168554.',
      ),
    ]);

    expect(result.registered).toBe(2);
    const movements = await transactions.list({ status: 'pending' });
    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'expense',
          accountId: credit.id,
          amountMinor: 5270,
          payee: 'SUPER LA TORRE JOCOTENA',
          occurredAt: new Date(2026, 10, 7, 14, 26).toISOString(),
          source: 'notification',
        }),
        expect.objectContaining({
          type: 'expense',
          accountId: monetary.id,
          amountMinor: 2825,
          localDate: '2026-10-24',
        }),
      ]),
    );
  });

  it('puts a purchase on the account’s only card', async () => {
    const visa = await createCardRepository(database.db).create({
      accountId: credit.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Consumo por Q.7.00 en EL ARTE DEL SABOR CUIK Cuenta TCREDITO 07-Nov 15:04 Autorizacion 231960.',
      ),
    ]);
    const [movement] = await transactions.list();
    expect(movement.cardId).toBe(visa.id);
  });

  it('registers the same SMS received twice only once (same authorization)', async () => {
    const text =
      'BiMovil: Consumo por Q.68.50 en SAN MARTIN ANTIGUA TELA Cuenta TCREDITO 07-Nov 13:13 Autorizacion 187838.';
    await importWalletNotifications(database, [sms(text), sms(text)]);
    await importWalletNotifications(database, [sms(text)]);

    expect(await transactions.list()).toHaveLength(1);
  });

  it('turns an ATM withdrawal into a transfer to cash and merges the bank’s second SMS', async () => {
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Retiro por Q.100.00 en el Cajero A-AG JOCOTENANGO con su tarjeta BICHEQUE3 07-Nov 15:26 Aut.174582.',
      ),
      sms(
        'BiMovil: Debito por Q.100.00 Cuenta AHORRO en la Agencia CAJEROS AUTOMATICOS 07-Nov 15:26 Autorizacion 7349.',
        RECEIVED + 1000,
      ),
    ]);

    const movements = await transactions.list();
    expect(movements).toEqual([
      expect.objectContaining({
        type: 'transfer',
        accountId: monetary.id,
        toAccountId: cash.id,
        amountMinor: 10000,
        description: 'Retiro en Cajero A-AG JOCOTENANGO',
      }),
    ]);
    // Cash moved, nothing was spent.
    expect(await transactions.getAccountBalance(monetary.id)).toBe(90000);
    expect(await transactions.getAccountBalance(cash.id)).toBe(10000);
    expect(await capturesWith('registered')).toBe(2);
    expect(await capturesWith('new')).toBe(0);
  });

  it('merges the debit SMS even when it arrives before the withdrawal', async () => {
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Debito por Q.100.00 Cuenta AHORRO en la Agencia CAJEROS AUTOMATICOS 07-Nov 15:26 Autorizacion 7349.',
      ),
    ]);
    expect(await capturesWith('new')).toBe(1);

    await importWalletNotifications(database, [
      sms(
        'BiMovil: Retiro por Q.100.00 en el Cajero A-AG JOCOTENANGO con su tarjeta BICHEQUE3 07-Nov 15:26 Aut.174582.',
      ),
    ]);
    expect(await transactions.list()).toHaveLength(1);
    expect(await capturesWith('new')).toBe(0);
  });

  it('keeps messages of an account without identifier in the inbox', async () => {
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Credito por  Q. 80.00 Cuenta AHORRO en la Agencia DIGITAL  25-Oct 09:53 Autorizacion 24146016.',
      ),
    ]);
    const [capture] = await createWalletCaptureRepository(database.db).listNew();
    expect(capture).toMatchObject({
      kind: 'income',
      amountMinor: 8000,
      accountLabel: 'AHORRO',
      merchant: 'Agencia DIGITAL',
    });
    expect(await transactions.list()).toEqual([]);
  });

  it('registers a deposit as income once the account has the identifier', async () => {
    const savings = await createAccountRepository(database.db).create({
      name: 'BI Ahorro',
      type: 'savings',
      currency: 'GTQ',
      initialBalanceMinor: 0,
      bankLabel: 'AHORRO',
    });
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Credito por  Q. 80.00 Cuenta AHORRO en la Agencia DIGITAL  25-Oct 09:53 Autorizacion 24146016.',
      ),
    ]);
    expect(await transactions.list()).toEqual([
      expect.objectContaining({ type: 'income', accountId: savings.id }),
    ]);
  });

  it('records one movement when Google Wallet and the bank SMS report the same purchase', async () => {
    await createCardRepository(database.db).create({
      accountId: credit.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
    await importWalletNotifications(database, [
      {
        id: 'wallet-1',
        packageName: WALLET,
        title: 'TB83 Plaza',
        text: 'Q250.00 con Visa •••• 4242',
        bigText: null,
        postedAt: new Date(2026, 10, 7, 14, 38, 20).getTime(),
      },
      sms(
        'BiMovil: Consumo por Q.250.00 en TB83 PLAZA JOCOTENANGO Cuenta TCREDITO 07-Nov 14:38 Autorizacion 181742.',
      ),
    ]);

    expect(await transactions.list()).toHaveLength(1);
    expect(await capturesWith('registered')).toBe(2);
  });

  it('ignores SMS that are not movements', async () => {
    const result = await importWalletNotifications(database, [
      sms('BiMovil: Tu codigo de seguridad es 482910'),
    ]);
    expect(result).toEqual({
      processedIds: [expect.any(String)],
      registered: 0,
      stored: 0,
    });
  });
});

describe('the inbox, once the account is configured', () => {
  it('registers waiting messages after the identifier is added to the account', async () => {
    const savings = await createAccountRepository(database.db).create({
      name: 'BI Ahorro',
      type: 'savings',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    await importWalletNotifications(database, [
      sms(
        'BiMovil: Credito por  Q. 80.00 Cuenta AHORRO en la Agencia DIGITAL  25-Oct 09:53 Autorizacion 24146016.',
      ),
    ]);
    expect(await registerWaitingCaptures(database)).toBe(0);

    await createAccountRepository(database.db).update(savings.id, {
      bankLabel: 'AHORRO',
    });

    expect(await registerWaitingCaptures(database)).toBe(1);
    expect(await transactions.list()).toEqual([
      expect.objectContaining({
        type: 'income',
        accountId: savings.id,
        amountMinor: 8000,
        status: 'pending',
        externalRef: 'ref:24146016:8000',
      }),
    ]);
    expect(await capturesWith('new')).toBe(0);
    expect(await registerWaitingCaptures(database)).toBe(0);
  });
});
