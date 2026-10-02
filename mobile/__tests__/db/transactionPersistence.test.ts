/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createDatabase,
  prepareDatabase,
  type Database,
} from '../../src/core/db';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import { createAccountRepository } from '../../src/features/accounts';
import { createCategoryRepository } from '../../src/features/categories';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../src/features/transactions';

function openFile(path: string): Promise<Database> {
  return prepareDatabase(
    createDatabase(createNodeSqliteExecutor(new DatabaseSync(path))),
  );
}

describe('transactions persist across connections', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'control-gastos-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads back movements and balances from a new connection', async () => {
    const path = join(directory, 'control-gastos.db');
    const first = await openFile(path);
    const accounts = createAccountRepository(first.db);
    const bank = await accounts.create({
      name: 'Banco',
      type: 'bank',
      currency: 'GTQ',
      initialBalanceMinor: 100000,
    });
    const cash = await accounts.create({
      name: 'Efectivo',
      type: 'cash',
      currency: 'GTQ',
      initialBalanceMinor: 0,
    });
    const [groceries] = await createCategoryRepository(first.db).list({
      kind: 'expense',
    });
    const base: NewTransaction = {
      type: 'expense',
      amountMinor: 45075,
      currency: 'GTQ',
      accountId: bank.id,
      toAccountId: null,
      categoryId: groceries.id,
      cardId: null,
      occurredAt: '2026-10-01T18:00:00.000Z',
      localDate: '2026-10-01',
      description: null,
      payee: 'La Torre',
      note: null,
      source: 'manual',
      status: 'confirmed',
      externalRef: null,
    };
    const transactions = createTransactionRepository(first.db);
    const expense = await transactions.create(base);
    const transfer = await transactions.create({
      ...base,
      type: 'transfer',
      amountMinor: 20000,
      toAccountId: cash.id,
      categoryId: null,
      payee: null,
    });
    // Like closing the app: nothing survives except the file.
    await first.close();

    const second = await openFile(path);
    try {
      const reopened = createTransactionRepository(second.db);
      expect(await reopened.getById(expense.id)).toEqual(expense);
      expect(await reopened.getById(transfer.id)).toEqual(transfer);
      expect(await reopened.listAccountBalances()).toEqual({
        [bank.id]: 100000 - 45075 - 20000,
        [cash.id]: 20000,
      });
    } finally {
      await second.close();
    }
  });
});
