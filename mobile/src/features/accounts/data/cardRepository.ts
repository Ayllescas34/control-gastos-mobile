import { and, asc, eq } from 'drizzle-orm';
import {
  cards,
  generateId,
  notDeleted,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import type { Card } from '../domain/types';
import { cardToInsert, rowToCard } from './cardMappers';

export type NewCard = Pick<Card, 'accountId' | 'alias' | 'last4' | 'network'>;

/** accountId is not editable: transactions reference (card_id, account_id) together. */
export type CardChanges = Partial<Pick<Card, 'alias' | 'last4' | 'network'>>;

/** Cards persistence. Reads exclude soft-deleted rows; nothing is physically deleted. */
export function createCardRepository(db: AppDatabase) {
  const isActive = (id: EntityId) => and(eq(cards.id, id), notDeleted(cards));

  return {
    async create(input: NewCard): Promise<Card> {
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

    async getById(id: EntityId): Promise<Card | null> {
      const row = await db.select().from(cards).where(isActive(id)).get();
      return row ? rowToCard(row) : null;
    },

    async listByAccount(accountId: EntityId): Promise<Card[]> {
      const rows = await db
        .select()
        .from(cards)
        .where(and(eq(cards.accountId, accountId), notDeleted(cards)))
        .orderBy(asc(cards.alias), asc(cards.createdAt));
      return rows.map(rowToCard);
    },

    /** Returns the updated card, or null when it does not exist or is deleted. */
    async update(id: EntityId, changes: CardChanges): Promise<Card | null> {
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

    /** Marks the card as deleted. Returns false when it was not active. */
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
