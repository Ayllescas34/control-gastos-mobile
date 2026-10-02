import type { EntityId } from '../../../shared/domain';
import type { Account, Card } from '../../accounts';
import type { Category, CategoryKind } from '../../categories';

/** Accounts, cards and categories by id, built once per load for list rows and forms. */
export type ReferenceLookup = {
  account(id: EntityId | null): Account | undefined;
  card(id: EntityId | null): Card | undefined;
  category(id: EntityId | null): Category | undefined;
  /** Accounts a new movement may use. */
  activeAccounts: Account[];
  /** Active cards of one account (a card must belong to the movement's account). */
  activeCardsOf(accountId: EntityId | null): Card[];
  /** Active categories of one kind (income or expense). */
  activeCategoriesOf(kind: CategoryKind): Category[];
  /** All categories (archived included) of one kind, for filters over past movements. */
  categoriesOf(kind: CategoryKind): Category[];
};

const isActive = (entity: { deletedAt: string | null }) =>
  entity.deletedAt === null;

export function createReferenceLookup(entities: {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
}): ReferenceLookup {
  const accounts = new Map(entities.accounts.map(a => [a.id, a]));
  const cards = new Map(entities.cards.map(c => [c.id, c]));
  const categories = new Map(entities.categories.map(c => [c.id, c]));
  const get = <T>(map: Map<EntityId, T>, id: EntityId | null) =>
    id === null ? undefined : map.get(id);

  return {
    account: id => get(accounts, id),
    card: id => get(cards, id),
    category: id => get(categories, id),
    activeAccounts: entities.accounts.filter(isActive),
    activeCardsOf: accountId =>
      entities.cards.filter(
        card => isActive(card) && card.accountId === accountId,
      ),
    activeCategoriesOf: kind =>
      entities.categories.filter(
        category => isActive(category) && category.kind === kind,
      ),
    categoriesOf: kind =>
      entities.categories.filter(category => category.kind === kind),
  };
}
