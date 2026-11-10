import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText } from '../../../shared/components';
import { Icon } from '../../../shared/icons';
import type { MinorUnits } from '../../../shared/lib/money';
import {
  layout,
  radius,
  spacing,
  useAppTheme,
} from '../../../shared/theme';
import {
  WALLET_CARD_ASPECT_RATIO,
  WalletCard,
  walletCardTones,
  type Account,
  type Card,
} from '../../accounts';

export type WalletAccount = {
  account: Account;
  balanceMinor: MinorUnits | null;
  cards: Card[];
};

type WalletCarouselProps = {
  accounts: readonly WalletAccount[];
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
};

/** How much of the next card peeks in, hinting that the row scrolls. */
const PEEK = spacing.xxxl;

/**
 * The accounts as cards in a wallet, swiped sideways and snapping card by card, with an
 * "add" slot at the end. Bleeds to the screen edges like a real wallet.
 */
export function WalletCarousel({
  accounts,
  onOpenAccount,
  onAddAccount,
}: WalletCarouselProps) {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const fullWidth = windowWidth - layout.screenPadding * 2;
  const cardWidth = accounts.length > 1 ? fullWidth - PEEK : fullWidth;
  const cardHeight = cardWidth / WALLET_CARD_ASPECT_RATIO;
  const addWidth = accounts.length === 0 ? fullWidth : cardWidth / 2;
  const tones = walletCardTones(accounts.map(({ account }) => account));

  return (
    <ScrollView
      testID="wallet-carousel"
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + spacing.md}
      snapToAlignment="start"
      style={styles.bleed}
      contentContainerStyle={styles.content}
    >
      {accounts.map(({ account, balanceMinor, cards }, index) => (
        <WalletCard
          key={account.id}
          tone={tones[index]}
          account={account}
          balanceMinor={balanceMinor}
          cards={cards}
          width={cardWidth}
          onPress={onOpenAccount}
        />
      ))}
      <Pressable
        testID="wallet-add-account"
        accessibilityRole="button"
        accessibilityLabel="Agregar cuenta o tarjeta"
        onPress={onAddAccount}
        style={({ pressed }) => [
          styles.add,
          {
            width: addWidth,
            height: cardHeight,
            borderColor: theme.colors.border,
            backgroundColor: pressed
              ? theme.colors.surfaceMuted
              : theme.colors.surface,
          },
        ]}
      >
        <View
          style={[styles.addIcon, { backgroundColor: theme.colors.surfaceMuted }]}
        >
          <Icon name="add" size="lg" color="primary" />
        </View>
        <AppText variant="label" color="textSecondary" style={styles.addText}>
          Agregar cuenta
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleeds past the screen padding, and leaves room for the cards' shadow so the scroll
  // view does not clip it into a visible band.
  bleed: {
    marginHorizontal: -layout.screenPadding,
    // Only into the section gap above, never over the "Administrar" action.
    marginTop: -spacing.sm,
    marginBottom: -spacing.xl,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  add: {
    borderRadius: radius.cardFeatured,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  addIcon: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    textAlign: 'center',
  },
});
