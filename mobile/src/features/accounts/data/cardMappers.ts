import type { CardInsert, CardRow } from '../../../core/db';
import type { Card } from '../domain/types';

/** DB row → domain entity. */
export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    accountId: row.accountId,
    alias: row.alias,
    last4: row.last4,
    network: row.network,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. */
export function cardToInsert(card: Card): CardInsert {
  return {
    id: card.id,
    accountId: card.accountId,
    alias: card.alias,
    last4: card.last4,
    network: card.network,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    deletedAt: card.deletedAt,
  };
}
