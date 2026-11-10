import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { Icon } from '../../../shared/icons';
import { formatMoney, type MinorUnits } from '../../../shared/lib/money';
import {
  radius,
  spacing,
  useAppTheme,
  type WalletCardTone,
} from '../../../shared/theme';
import type { Account, Card } from '../domain/types';
import {
  ACCOUNT_TYPE_VISUALS,
  CARD_NETWORK_LABELS,
  maskLast4,
} from './accountVisuals';

/** ISO/IEC 7810 ID-1: the proportions of a real payment card. */
export const WALLET_CARD_ASPECT_RATIO = 1.586;

type WalletCardProps = {
  account: Account;
  balanceMinor: MinorUnits | null;
  /** Active cards of the account; the first one is shown on the face. */
  cards: readonly Card[];
  width: number;
  /** Face colour; defaults to the account type's (accountVisuals). */
  tone?: WalletCardTone;
  onPress: (accountId: string) => void;
};

/**
 * An account drawn as a card in a wallet: type, name, balance and the plastic linked to it.
 * The face colour follows the account type (accountVisuals).
 */
export const WalletCard = memo(function WalletCardView({
  account,
  balanceMinor,
  cards,
  width,
  tone,
  onPress,
}: WalletCardProps) {
  const theme = useAppTheme();
  const visual = ACCOUNT_TYPE_VISUALS[account.type];
  const face = theme.walletCardFaces[tone ?? visual.cardTone];
  const [card] = cards;
  const balance =
    balanceMinor === null ? '—' : formatMoney(balanceMinor, account.currency);
  const extraCards = cards.length > 1 ? ` +${cards.length - 1}` : '';
  const cardText = card ? `${maskLast4(card.last4)}${extraCards}` : null;

  return (
    <Pressable
      testID={`wallet-card-${account.id}`}
      accessibilityRole="button"
      accessibilityLabel={[
        `${visual.label}: ${account.name}`,
        `saldo ${balance}`,
        card ? `tarjeta terminada en ${card.last4}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Abre el detalle de la cuenta"
      onPress={() => onPress(account.id)}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height: width / WALLET_CARD_ASPECT_RATIO,
          backgroundColor: face.solid,
          backgroundImage: face.gradient,
        },
        theme.shadows.md,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.type}>
          <Icon name={visual.icon} size="sm" color="onFeatured" />
          <AppText variant="label" color="onFeaturedMuted">
            {visual.label}
          </AppText>
        </View>
        {card?.network && (
          <AppText variant="bodyStrong" color="onFeatured">
            {CARD_NETWORK_LABELS[card.network]}
          </AppText>
        )}
      </View>

      <AppText variant="heading" color="onFeatured" numberOfLines={1}>
        {account.name}
      </AppText>

      <View style={styles.row}>
        <View style={styles.balance}>
          <AppText variant="caption" color="onFeaturedMuted">
            Saldo
          </AppText>
          <AppText
            variant="amountLarge"
            color="onFeatured"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {balance}
          </AppText>
        </View>
        {cardText && (
          <AppText variant="amount" color="onFeaturedMuted">
            {cardText}
          </AppText>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.cardFeatured,
    padding: spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  balance: {
    flexShrink: 1,
  },
});
