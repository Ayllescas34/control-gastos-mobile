import { and, asc, eq } from 'drizzle-orm';
import {
  accounts,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import type { Account } from '../domain/types';
import { accountToInsert, rowToAccount } from './accountMappers';

export type NewAccount = Pick<
  Account,
  'name' | 'type' | 'currency' | 'initialBalanceMinor'
>;

/**
 * Currency is not editable: a transaction's currency must match its account's
 * (docs/domain-model.md, rule 6), so changing it would invalidate existing transactions.
 */
export type AccountChanges = Partial<
  Pick<Account, 'name' | 'type' | 'initialBalanceMinor'>
>;

/** Accounts persistence. Reads exclude soft-deleted rows; nothing is physically deleted. */
export function createAccountRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(accounts.id, id), notDeleted(accounts));

  return {
    async create(input: NewAccount): Promise<Account> {
      const now = nowIsoDateTime();
      const account: Account = {
        id: await generateId(db),
        name: input.name,
        type: input.type,
        currency: input.currency,
        initialBalanceMinor: input.initialBalanceMinor,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.insert(accounts).values(accountToInsert(account));
      return account;
    },

    async getById(id: EntityId): Promise<Account | null> {
      const row = await db.select().from(accounts).where(isActive(id)).get();
      return row ? rowToAccount(row) : null;
    },

    async list(): Promise<Account[]> {
      const rows = await db
        .select()
        .from(accounts)
        .where(notDeleted(accounts))
        .orderBy(asc(accounts.name), asc(accounts.createdAt));
      return rows.map(rowToAccount);
    },

    /** Returns the updated account, or null when it does not exist or is deleted. */
    async update(id: EntityId, changes: AccountChanges): Promise<Account | null> {
      const rows = await db
        .update(accounts)
        .set({
          name: changes.name,
          type: changes.type,
          initialBalanceMinor: changes.initialBalanceMinor,
          updatedAt: nowIsoDateTime(),
        })
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToAccount(rows[0]) : null;
    },

    /** Marks the account as deleted. Returns false when it was not active. */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(accounts)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: accounts.id });
      return rows.length > 0;
    },
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
