import { and, asc, eq } from 'drizzle-orm';
import {
  accounts,
  cards,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import { InvalidCardError } from '../domain/accountErrors';
import type { Card } from '../domain/types';
import { validateCard, type CardFields } from '../domain/validateCard';
import { cardToInsert, rowToCard } from './cardMappers';

export type NewCard = Pick<Card, 'accountId' | 'alias' | 'last4' | 'network'>;

/** accountId is not editable: transactions reference (card_id, account_id) together. */
export type CardChanges = Partial<Pick<Card, 'alias' | 'last4' | 'network'>>;

/**
 * Cards persistence. Domain rules run first (validateCard, including that the account is
 * active); the schema's CHECKs and foreign keys are the second barrier. Reads exclude
 * soft-deleted rows; nothing is physically deleted.
 *
 * SECURITY: only alias, last4 and network are stored. Never a full card number, CVV or PIN.
 */
export function createCardRepository(db: AppDatabase) {
  const isActive = (id: EntityId) => and(eq(cards.id, id), notDeleted(cards));

  async function assertValid(card: CardFields): Promise<void> {
    const account =
      card.accountId.length === 0
        ? null
        : (await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(and(eq(accounts.id, card.accountId), notDeleted(accounts)))
            .get()) ?? null;
    const result = validateCard(card, { account });
    if (!result.valid) {
      throw new InvalidCardError(result.errors);
    }
  }

  async function getById(id: EntityId): Promise<Card | null> {
    const row = await db.select().from(cards).where(isActive(id)).get();
    return row ? rowToCard(row) : null;
  }

  return {
    getById,

    async create(input: NewCard): Promise<Card> {
      await assertValid(input);
      const now = nowIsoDateTime();
      const card: Card = {
        id: await generateId(db),
        accountId: input.accountId,
        alias: input.alias,
        last4: input.last4,
        network: input.network,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db.insert(cards).values(cardToInsert(card));
      return card;
    },

    /** All active cards, ordered by alias. */
    async list(): Promise<Card[]> {
      const rows = await db
        .select()
        .from(cards)
        .where(notDeleted(cards))
        .orderBy(asc(cards.alias), asc(cards.createdAt));
      return rows.map(rowToCard);
    },

    async listByAccount(accountId: EntityId): Promise<Card[]> {
      const rows = await db
        .select()
        .from(cards)
        .where(and(eq(cards.accountId, accountId), notDeleted(cards)))
        .orderBy(asc(cards.alias), asc(cards.createdAt));
      return rows.map(rowToCard);
    },

    /**
     * Validates the resulting card before writing. Returns the updated card, or null when
     * it does not exist or is deleted.
     */
    async update(id: EntityId, changes: CardChanges): Promise<Card | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      await assertValid({
        accountId: current.accountId,
        alias: changes.alias ?? current.alias,
        last4: changes.last4 ?? current.last4,
        network:
          changes.network === undefined ? current.network : changes.network,
      });
      const rows = await db
        .update(cards)
        .set({
          alias: changes.alias,
          last4: changes.last4,
          network: changes.network,
          updatedAt: nowIsoDateTime(),
        })
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToCard(rows[0]) : null;
    },

    /** Archives the card (soft delete). Returns false when it was not active. */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(cards)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: cards.id });
      return rows.length > 0;
    },
  };
}

export type CardRepository = ReturnType<typeof createCardRepository>;
