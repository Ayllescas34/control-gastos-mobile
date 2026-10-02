import { sql } from 'drizzle-orm';
import { accounts, cards, type Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  AccountHasActiveCardsError,
  createAccountRepository,
  createCardRepository,
  InvalidAccountError,
  InvalidCardError,
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

  it('rejects a missing account in the domain before writing', async () => {
    await expect(
      cardRepo.create({
        accountId: 'missing-account',
        alias: 'Huérfana',
        last4: '1234',
        network: 'visa',
      }),
    ).rejects.toMatchObject({ errors: ['account_not_found'] });
  });

  it('enforces the account foreign key in SQLite (second barrier)', async () => {
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO ${cards} VALUES ('c', 'missing-account', 'X', '1234', NULL, ${NOW}, ${NOW}, NULL)`,
        ),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('does not allow physically deleting an account that has cards', async () => {
    const account = await newBank();
    await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });
    expect(
      await sqliteErrorMessage(
        database.db.run(sql`DELETE FROM accounts WHERE id = ${account.id}`),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);
  });

  it.each(['123', '12345', 'abcd', '12a4'])(
    'rejects last4 = %p in the domain and in SQLite',
    async last4 => {
      const account = await newBank();
      await expect(
        cardRepo.create({
          accountId: account.id,
          alias: 'Mala',
          last4,
          network: 'visa',
        }),
      ).rejects.toMatchObject({ errors: ['last4_invalid'] });
      expect(
        await sqliteErrorMessage(
          database.db.run(
            sql`INSERT INTO ${cards} VALUES ('c', ${account.id}, 'X', ${last4}, NULL, ${NOW}, ${NOW}, NULL)`,
          ),
        ),
      ).toMatch(/cards_last4_check/);
    },
  );

  it('rejects an unknown network', async () => {
    const account = await newBank();
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO ${cards} VALUES ('c', ${account.id}, 'X', '1234', 'diners', ${NOW}, ${NOW}, NULL)`,
        ),
      ),
    ).toMatch(/cards_network_check/);
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

describe('accountRepository domain validation', () => {
  it('rejects an invalid account before writing anything', async () => {
    await expect(
      accountRepo.create({
        name: '   ',
        type: 'bank',
        currency: 'gtq',
        initialBalanceMinor: 10.5,
      }),
    ).rejects.toBeInstanceOf(InvalidAccountError);
    await expect(
      accountRepo.create({
        name: '   ',
        type: 'bank',
        currency: 'gtq',
        initialBalanceMinor: 10.5,
      }),
    ).rejects.toMatchObject({
      errors: ['name_required', 'currency_invalid', 'initial_balance_invalid'],
    });
    expect(await accountRepo.list()).toEqual([]);
  });

  it('validates the resulting account on update and keeps the old values', async () => {
    const account = await newBank();
    await expect(
      accountRepo.update(account.id, { name: '' }),
    ).rejects.toMatchObject({ errors: ['name_required'] });
    expect((await accountRepo.getById(account.id))?.name).toBe('Banco');
  });

  it('updates the editable fields; the currency stays', async () => {
    const account = await newBank();
    const updated = await accountRepo.update(account.id, {
      type: 'savings',
      initialBalanceMinor: -2500,
    });
    expect(updated).toMatchObject({
      name: 'Banco',
      type: 'savings',
      currency: 'GTQ',
      initialBalanceMinor: -2500,
    });
  });

  it('lists active accounts only, by name', async () => {
    const zeta = await accountRepo.create({
      name: 'Zeta',
      type: 'cash',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const alfa = await accountRepo.create({
      name: 'Alfa',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const archived = await newBank();
    await accountRepo.softDelete(archived.id);

    expect((await accountRepo.list()).map(a => a.id)).toEqual([
      alfa.id,
      zeta.id,
    ]);
  });
});

describe('archiving an account', () => {
  it('is refused while the account has active cards, without cascading', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });

    await expect(accountRepo.softDelete(account.id)).rejects.toBeInstanceOf(
      AccountHasActiveCardsError,
    );
    await expect(accountRepo.softDelete(account.id)).rejects.toMatchObject({
      activeCardCount: 1,
    });
    expect(await accountRepo.getById(account.id)).not.toBeNull();
    expect(await cardRepo.getById(card.id)).not.toBeNull();
  });

  it('is allowed once its cards are archived; rows are kept', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });
    await cardRepo.softDelete(card.id);

    expect(await accountRepo.softDelete(account.id)).toBe(true);
    expect(await accountRepo.list()).toEqual([]);
    const [[rows]] = await database.db.values<[number]>(
      sql`SELECT count(*) FROM ${accounts}`,
    );
    expect(rows).toBe(1);
  });
});

describe('cardRepository list and validation', () => {
  it('lists active cards of every account, by alias, excluding archived', async () => {
    const bank = await newBank();
    const credit = await accountRepo.create({
      name: 'Crédito',
      type: 'credit_card',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const visa = await cardRepo.create({
      accountId: credit.id,
      alias: 'Visa',
      last4: '4242',
      network: 'visa',
    });
    const debit = await cardRepo.create({
      accountId: bank.id,
      alias: 'Débito',
      last4: '1111',
      network: 'mastercard',
    });
    const old = await cardRepo.create({
      accountId: bank.id,
      alias: 'Antigua',
      last4: '9999',
      network: null,
    });
    await cardRepo.softDelete(old.id);

    expect((await cardRepo.list()).map(c => c.id)).toEqual([debit.id, visa.id]);
    expect((await cardRepo.listByAccount(bank.id)).map(c => c.id)).toEqual([
      debit.id,
    ]);
  });

  it('does not add cards to an archived account', async () => {
    const account = await newBank();
    await accountRepo.softDelete(account.id);

    await expect(
      cardRepo.create({
        accountId: account.id,
        alias: 'Tarde',
        last4: '1234',
        network: null,
      }),
    ).rejects.toMatchObject({ errors: ['account_not_found'] });
  });

  it('validates the resulting card on update', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });

    await expect(
      cardRepo.update(card.id, { last4: '4111111111111111' }),
    ).rejects.toBeInstanceOf(InvalidCardError);
    expect((await cardRepo.getById(card.id))?.last4).toBe('1234');

    expect(await cardRepo.update(card.id, { network: null })).toMatchObject({
      network: null,
      alias: 'Débito',
    });
  });

  it('returns null when updating an archived card', async () => {
    const account = await newBank();
    const card = await cardRepo.create({
      accountId: account.id,
      alias: 'Débito',
      last4: '1234',
      network: 'visa',
    });
    await cardRepo.softDelete(card.id);
    expect(await cardRepo.update(card.id, { alias: 'Otra' })).toBeNull();
  });
});
