import { sql } from 'drizzle-orm';
import {
  accounts,
  cards,
  transactions,
  type AccountRow,
  type CardRow,
  type TransactionRow,
} from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import {
  accountToInsert,
  rowToAccount,
} from '../../src/features/accounts/data/accountMappers';
import { cardToInsert, rowToCard } from '../../src/features/accounts/data/cardMappers';
import {
  rowToTransaction,
  transactionToInsert,
} from '../../src/features/transactions/data/transactionMappers';
import type { Account, Card } from '../../src/features/accounts';
import type { Transaction } from '../../src/features/transactions';

const NOW = '2026-09-30T12:00:00.000Z';

const account: Account = {
  id: 'a1',
  name: 'Banco',
  type: 'bank',
  currency: 'GTQ',
  initialBalanceMinor: -12345,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const card: Card = {
  id: 'c1',
  accountId: 'a1',
  alias: 'Débito',
  last4: '0007',
  network: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: NOW,
};

const transaction: Transaction = {
  id: 't1',
  type: 'expense',
  amountMinor: Number.MAX_SAFE_INTEGER,
  currency: 'GTQ',
  accountId: 'a1',
  toAccountId: null,
  categoryId: 'cat-1',
  cardId: 'c1',
  occurredAt: NOW,
  localDate: '2026-09-30',
  description: 'Compra',
  payee: null,
  note: null,
  source: 'import',
  status: 'pending',
  externalRef: 'bank-123',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

describe('domain → DB', () => {
  it('maps every field, keeping nulls and exact integers', () => {
    expect(accountToInsert(account)).toEqual(account);
    expect(cardToInsert(card)).toEqual(card);
    expect(transactionToInsert(transaction)).toEqual(transaction);
  });
});

describe('DB → domain', () => {
  it('maps every field of a row', () => {
    const accountRow: AccountRow = { ...account };
    const cardRow: CardRow = { ...card };
    const transactionRow: TransactionRow = { ...transaction };

    expect(rowToAccount(accountRow)).toEqual(account);
    expect(rowToCard(cardRow)).toEqual(card);
    expect(rowToTransaction(transactionRow)).toEqual(transaction);
  });

  it('returns a new object, not the row itself', () => {
    const row: AccountRow = { ...account };
    expect(rowToAccount(row)).not.toBe(row);
  });
});

describe('camelCase ↔ snake_case columns', () => {
  it('writes domain fields to their snake_case columns and reads them back', async () => {
    const database = await createTestDatabase();
    const { db } = database;
    await db.insert(accounts).values(accountToInsert(account));
    await db.insert(cards).values(cardToInsert({ ...card, deletedAt: null }));
    await db
      .insert(transactions)
      .values(transactionToInsert({ ...transaction, categoryId: null }));

    expect(
      await db.values(
        sql`SELECT initial_balance_minor, created_at, deleted_at FROM accounts`,
      ),
    ).toEqual([[-12345, NOW, null]]);
    expect(
      await db.values(sql`SELECT account_id, last4, network FROM cards`),
    ).toEqual([['a1', '0007', null]]);
    expect(
      await db.values(
        sql`SELECT amount_minor, account_id, to_account_id, card_id, local_date, external_ref FROM transactions`,
      ),
    ).toEqual([
      [Number.MAX_SAFE_INTEGER, 'a1', null, 'c1', '2026-09-30', 'bank-123'],
    ]);

    const [row] = await db.select().from(transactions);
    expect(rowToTransaction(row)).toEqual({ ...transaction, categoryId: null });
    await database.close();
  });
});
