import { and, asc, count, eq } from 'drizzle-orm';
import {
  accounts,
  cards,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import {
  AccountHasActiveCardsError,
  InvalidAccountError,
} from '../domain/accountErrors';
import type { Account } from '../domain/types';
import { validateAccount } from '../domain/validateAccount';
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

function assertValid(account: NewAccount): void {
  const result = validateAccount(account);
  if (!result.valid) {
    throw new InvalidAccountError(result.errors);
  }
}

/**
 * Accounts persistence. Domain rules run first (validateAccount); the schema's CHECKs are
 * the second barrier. Reads exclude soft-deleted rows; nothing is physically deleted.
 */
export function createAccountRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(accounts.id, id), notDeleted(accounts));

  async function getById(id: EntityId): Promise<Account | null> {
    const row = await db.select().from(accounts).where(isActive(id)).get();
    return row ? rowToAccount(row) : null;
  }

  return {
    getById,

    async create(input: NewAccount): Promise<Account> {
      assertValid(input);
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

    async list(): Promise<Account[]> {
      const rows = await db
        .select()
        .from(accounts)
        .where(notDeleted(accounts))
        .orderBy(asc(accounts.name), asc(accounts.createdAt));
      return rows.map(rowToAccount);
    },

    /**
     * Validates the resulting account before writing. Returns the updated account, or null
     * when it does not exist or is deleted.
     */
    async update(
      id: EntityId,
      changes: AccountChanges,
    ): Promise<Account | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      assertValid({
        name: changes.name ?? current.name,
        type: changes.type ?? current.type,
        currency: current.currency,
        initialBalanceMinor:
          changes.initialBalanceMinor ?? current.initialBalanceMinor,
      });
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

    /**
     * Archives the account (soft delete). Refused while it has active cards: archiving never
     * cascades, so cards are archived first. Returns false when it was not active.
     */
    async softDelete(id: EntityId): Promise<boolean> {
      const [{ activeCards }] = await db
        .select({ activeCards: count() })
        .from(cards)
        .where(and(eq(cards.accountId, id), notDeleted(cards)));
      if (activeCards > 0) {
        throw new AccountHasActiveCardsError(activeCards);
      }

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
