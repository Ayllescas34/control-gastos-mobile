import { sql } from 'drizzle-orm';
import { accounts, cards, type Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  createAccountRepository,
  createCardRepository,
  type AccountRepository,
  type CardRepository,
} from '../../src/features/accounts';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const NOW = '2026-09-30T12:00:00.000Z';

let database: Database;
let accountRepo: AccountRepository;
let cardRepo: CardRepository;

beforeEach(async () => {
  database = await createTestDatabase();
  accountRepo = createAccountRepository(database.db);
  cardRepo = createCardRepository(database.db);
});

afterEach(() => database.close());

function newBank() {
  return accountRepo.create({
    name: 'Banco',
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 150000,
  });
}

describe('accountRepository', () => {
  it('creates an account with app-generated id and UTC timestamps', async () => {
    const account = await newBank();

    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(account.createdAt).toMatch(ISO_UTC);
    expect(account.updatedAt).toBe(account.createdAt);
    expect(account.deletedAt).toBeNull();
  });

  it('reads back the same domain entity', async () => {
    const account = await newBank();
    expect(await accountRepo.getById(account.id)).toEqual(account);
    expect(await accountRepo.getById('missing')).toBeNull();
  });

  it('accepts a negative initial balance (credit card debt)', async () => {
    const card = await accountRepo.create({
      name: 'Visa',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: -25000,
    });
    expect((await accountRepo.getById(card.id))?.initialBalanceMinor).toBe(
      -25000,
    );
  });

  it('updates editable fields and updatedAt', async () => {
    const account = await newBank();
    const updated = await accountRepo.update(account.id, {
      name: 'Banco principal',
    });

    expect(updated).toMatchObject({
      id: account.id,
      name: 'Banco principal',
      type: 'bank',
      initialBalanceMinor: 150000,
      createdAt: account.createdAt,
    });
    expect(updated?.updatedAt).toMatch(ISO_UTC);
    expect(await accountRepo.getById(account.id)).toEqual(updated);
  });

  it('soft deletes: the row stays but normal reads exclude it', async () => {
    const kept = await newBank();
    const removed = await newBank();

    expect(await accountRepo.softDelete(removed.id)).toBe(true);
    expect(await accountRepo.softDelete(removed.id)).toBe(false);

    expect(await accountRepo.getById(removed.id)).toBeNull();
    expect((await accountRepo.list()).map(a => a.id)).toEqual([kept.id]);
    expect(await accountRepo.update(removed.id, { name: 'x' })).toBeNull();

    const [[deletedAt]] = await database.db.values<[string]>(
      sql`SELECT deleted_at FROM ${accounts} WHERE id = ${removed.id}`,
    );
    expect(deletedAt).toMatch(ISO_UTC);
  });

  it('rejects an unknown account type and an invalid currency in the DB', async () => {
    expect(await sqliteErrorMessage(database.db.run(
        sql`INSERT INTO accounts VALUES ('x', 'X', 'crypto', 'GTQ', 0, ${NOW}, ${NOW}, NULL)`,
      ))).toMatch(/accounts_type_check/);
    expect(await sqliteErrorMessage(database.db.run(
        sql`INSERT INTO accounts VALUES ('x', 'X', 'bank', 'gtq', 0, ${NOW}, ${NOW}, NULL)`,
      ))).toMatch(/accounts_currency_check/);
  });

  it('rejects money stored as REAL and timestamps that are not ISO UTC', async () => {
    expect(await sqliteErrorMessage(database.db.run(
        sql`INSERT INTO accounts VALUES ('x', 'X', 'bank', 'GTQ', 10.5, ${NOW}, ${NOW}, NULL)`,
      ))).toMatch(/accounts_initial_balance_minor_check/);
    expect(await sqliteErrorMessage(database.db.run(
        sql`INSERT INTO accounts VALUES ('x', 'X', 'bank', 'GTQ', 0, '2026-09-30 12:00:00', ${NOW}, NULL)`,
      ))).toMatch(/accounts_timestamps_check/);
  });
});

describe('cardRepository', () => {
  it('creates a card that belongs to an account', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '0042',
      network: 'visa',
    });

    expect(await cardRepo.getById(card.id)).toEqual(card);
    expect(await cardRepo.listByAccount(account.id)).toEqual([card]);
    expect(card.last4).toBe('0042'); // leading zeros preserved
  });

  it('allows a null network', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Sin red',
      last4: '1111',
      network: null,
    });
    expect((await cardRepo.getById(card.id))?.network).toBeNull();
  });

  it('enforces the account foreign key', async () => {
    expect(await sqliteErrorMessage(cardRepo.create({
        accountId: 'missing-account',
        alias: 'Huérfana',
        last4: '1234',
        network: 'visa',
      }))).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('does not allow physically deleting an account that has cards', async () => {
    const account = await newBank();
    await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });
    expect(await sqliteErrorMessage(database.db.run(sql`DELETE FROM accounts WHERE id = ${account.id}`))).toMatch(/FOREIGN KEY constraint failed/);
  });

  it.each(['123', '12345', 'abcd', '12a4'])(
    'rejects last4 = %p',
    async last4 => {
      const account = await newBank();
      expect(await sqliteErrorMessage(cardRepo.create({
          accountId: account.id,
          alias: 'Mala',
          last4,
          network: 'visa',
        }))).toMatch(/cards_last4_check/);
    },
  );

  it('rejects an unknown network', async () => {
    const account = await newBank();
    expect(await sqliteErrorMessage(database.db.run(
        sql`INSERT INTO ${cards} VALUES ('c', ${account.id}, 'X', '1234', 'diners', ${NOW}, ${NOW}, NULL)`,
      ))).toMatch(/cards_network_check/);
  });

  it('updates and soft deletes a card', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });

    const updated = await cardRepo.update(card.id, { alias: 'Débito nómina' });
    expect(updated).toMatchObject({ alias: 'Débito nómina', last4: '1234' });

    expect(await cardRepo.softDelete(card.id)).toBe(true);
    expect(await cardRepo.getById(card.id)).toBeNull();
    expect(await cardRepo.listByAccount(account.id)).toEqual([]);
  });
});
