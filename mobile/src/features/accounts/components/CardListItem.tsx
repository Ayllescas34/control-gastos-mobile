import { ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import type { Account, Card } from '../domain/types';
import { cardNetworkLabel, maskLast4 } from './accountVisuals';

type CardListItemProps = {
  card: Card;
  /** Shown as context when the list mixes cards of several accounts. */
  account?: Account;
  onPress: (cardId: string) => void;
};

/** A card in a list: alias, masked last four digits and network or account. Never more. */
export function CardListItem({ card, account, onPress }: CardListItemProps) {
  const details = [
    maskLast4(card.last4),
    account?.name ?? cardNetworkLabel(card.network),
  ];

  return (
    <ListItem
      testID={`card-${card.id}`}
      title={card.alias}
      subtitle={details.join(' · ')}
      leading={<IconBadge name="creditCard" variant="neutral" />}
      onPress={() => onPress(card.id)}
      accessibilityLabel={`${card.alias}, terminada en ${card.last4}${
        account ? `, cuenta ${account.name}` : ''
      }`}
      accessibilityHint="Abre el detalle de la tarjeta"
    />
  );
}
