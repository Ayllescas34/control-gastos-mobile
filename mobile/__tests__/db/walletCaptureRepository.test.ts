import { sql } from 'drizzle-orm';
import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import type { RawWalletNotification } from '../../src/core/native/walletCaptures';
import {
  createBackupRepository,
  parseBackup,
  serializeBackup,
} from '../../src/features/backup';
import {
  createAccountRepository,
  createCardRepository,
  type Account,
  type Card,
} from '../../src/features/accounts';
import { createCategoryRepository } from '../../src/features/categories';
import {
  createTransactionRepository,
  type TransactionRepository,
} from '../../src/features/transactions';
import {
  createWalletCaptureRepository,
  importWalletNotifications,
  registerWalletCapture,
  WalletCaptureNotAvailableError,
} from '../../src/features/wallet';

const WALLET = 'com.google.android.apps.walletnfcrel';
const POSTED_AT = Date.parse('2026-11-05T18:30:00.000Z');

let database: Database;
let transactions: TransactionRepository;
let bank: Account;
let credit: Account;
let visa: Card;

function raw(
  id: string,
  title: string | null,
  text: string | null,
): RawWalletNotification {
  return { id, packageName: WALLET, title, text, bigText: null, postedAt: POSTED_AT };
}

beforeEach(async () => {
  database = await createTestDatabase();
  const accounts = createAccountRepository(database.db);
  const cards = createCardRepository(database.db);
  transactions = createTransactionRepository(database.db);
  bank = await accounts.create({
    name: 'Banco',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 100000,
  });
  credit = await accounts.create({
    name: 'Crédito',
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });
  visa = await cards.create({
    accountId: credit.id,
    alias: 'Visa',
    last4: '4242',
    network: 'visa',
  });
});

afterEach(() => database.close());

describe('importWalletNotifications', () => {
  it('registers a payment on the card with those last four digits, pending review', async () => {
    const result = await importWalletNotifications(database, [
      raw('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
    ]);

    expect(result).toEqual({ processedIds: ['n1'], registered: 1, stored: 0 });
    const [movement] = await transactions.list({ status: 'pending' });
    expect(movement).toMatchObject({
      type: 'expense',
      amountMinor: 4500,
      currency: 'GTQ',
      accountId: credit.id,
      cardId: visa.id,
      payee: 'Starbucks',
      source: 'notification',
      status: 'pending',
      externalRef: 'n1',
      occurredAt: '2026-11-05T18:30:00.000Z',
    });
    // Counts in the balance right away: the money already left.
    expect(await transactions.getAccountBalance(credit.id)).toBe(-4500);
    expect(await createWalletCaptureRepository(database.db).listNew()).toEqual(
      [],
    );
  });

  it('suggests the category of the merchant’s previous expense', async () => {
    const [coffee] = (
      await createCategoryRepository(database.db).list()
    ).filter(category => category.kind === 'expense');
    await transactions.create({
      type: 'expense',
      amountMinor: 3000,
      currency: 'GTQ',
      accountId: bank.id,
      toAccountId: null,
      categoryId: coffee.id,
      cardId: null,
      occurredAt: '2026-11-01T10:00:00.000Z',
      localDate: '2026-11-01',
      description: null,
      payee: 'STARBUCKS',
      note: null,
      source: 'manual',
      status: 'confirmed',
      externalRef: null,
    });

    await importWalletNotifications(database, [
      raw('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
    ]);

    const [movement] = await transactions.list({ status: 'pending' });
    expect(movement.categoryId).toBe(coffee.id);
  });

  it('keeps unmatched payments in the inbox and never duplicates a notification', async () => {
    const notifications = [
      raw('n1', 'Uber', 'Q30.00 con Mastercard •••• 9999'),
      raw('n2', 'Tienda', 'Q10.00'),
      raw('n3', 'Pase agregado', 'Tu boleto está listo'),
    ];
    const first = await importWalletNotifications(database, notifications);
    const again = await importWalletNotifications(database, notifications);

    expect(first).toEqual({
      processedIds: ['n1', 'n2', 'n3'],
      registered: 0,
      stored: 2,
    });
    expect(again).toEqual({
      processedIds: ['n1', 'n2', 'n3'],
      registered: 0,
      stored: 0,
    });
    const inbox = await createWalletCaptureRepository(database.db).listNew();
    expect(inbox.map(capture => capture.merchant).sort()).toEqual([
      'Tienda',
      'Uber',
    ]);
    expect(await transactions.list()).toEqual([]);
  });

  it('leaves a payment in another currency than the card’s account in the inbox', async () => {
    await importWalletNotifications(database, [
      raw('n1', 'Amazon', 'US$20.00 con Visa •••• 4242'),
    ]);
    expect(await transactions.list()).toEqual([]);
    expect(
      await createWalletCaptureRepository(database.db).listNew(),
    ).toHaveLength(1);
  });

  it('does not auto-register when two active cards share the last four digits', async () => {
    await createCardRepository(database.db).create({
      accountId: bank.id,
      alias: 'Débito',
      last4: '4242',
      network: 'visa',
    });
    await importWalletNotifications(database, [
      raw('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
    ]);
    expect(await transactions.list()).toEqual([]);
  });
});

describe('inbox actions', () => {
  it('registers a capture as a confirmed movement and links it, once', async () => {
    await importWalletNotifications(database, [
      raw('n1', 'Tienda', 'Q10.00'),
    ]);
    const captures = createWalletCaptureRepository(database.db);
    const [capture] = await captures.listNew();

    const movement = await registerWalletCapture(database, capture.id, {
      type: 'expense',
      amountMinor: 1000,
      currency: 'GTQ',
      accountId: bank.id,
      toAccountId: null,
      categoryId: null,
      cardId: null,
      occurredAt: '2026-11-05T18:30:00.000Z',
      localDate: '2026-11-05',
      description: null,
      payee: 'Tienda',
      note: null,
      source: 'manual',
      status: 'confirmed',
      externalRef: null,
    });

    expect(movement).toMatchObject({
      source: 'notification',
      status: 'confirmed',
      externalRef: 'n1',
    });
    expect(await captures.getById(capture.id)).toMatchObject({
      status: 'registered',
      transactionId: movement.id,
    });
    await expect(
      registerWalletCapture(database, capture.id, movement),
    ).rejects.toBeInstanceOf(WalletCaptureNotAvailableError);
  });

  it('dismisses a capture, keeping its evidence', async () => {
    await importWalletNotifications(database, [
      raw('n1', 'Tienda', 'Q10.00'),
    ]);
    const captures = createWalletCaptureRepository(database.db);
    const [capture] = await captures.listNew();

    expect(await captures.dismiss(capture.id)).toBe(true);
    expect(await captures.dismiss(capture.id)).toBe(false);
    expect(await captures.listNew()).toEqual([]);
    expect(await captures.getById(capture.id)).toMatchObject({
      status: 'dismissed',
    });
  });

  it('rejects a second movement with the same automatic origin', async () => {
    await importWalletNotifications(database, [
      raw('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
    ]);
    const [movement] = await transactions.list();
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO transactions SELECT 'copy', type, amount_minor, currency, account_id, to_account_id, category_id, card_id, occurred_at, local_date, description, payee, note, source, status, external_ref, created_at, updated_at, deleted_at FROM transactions WHERE id = ${movement.id}`,
        ),
      ),
    ).toMatch(/UNIQUE constraint failed: transactions\.source, transactions\.external_ref/);
  });
});

describe('backup restore', () => {
  it('clears the device-local inbox, which references the replaced movements', async () => {
    await importWalletNotifications(database, [
      raw('n1', 'Starbucks', 'Q45.00 con Visa •••• 4242'),
      raw('n2', 'Tienda', 'Q10.00'),
    ]);
    const backups = createBackupRepository(database);
    const backup = parseBackup(
      serializeBackup(await backups.exportBackup()),
      await backups.currentSchemaVersion(),
    );

    await backups.restoreBackup(backup);

    const [[captures]] = await database.db.values<[number]>(
      sql`SELECT count(*) FROM wallet_captures`,
    );
    expect(captures).toBe(0);
    // The movement itself is in the backup and comes back with its origin.
    expect(await transactions.list()).toEqual([
      expect.objectContaining({ externalRef: 'n1', status: 'pending' }),
    ]);
  });
});
