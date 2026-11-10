import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { Icon } from '../../../shared/icons';
import {
  layout,
  radius,
  spacing,
  useAppTheme,
  withAlpha,
} from '../../../shared/theme';
import type { WalletConnection } from '../data/syncWallet';
import { CONNECTION_COPY } from './walletPresentation';

type WalletConnectionCardProps = {
  connection: WalletConnection;
  /** Movements and captures waiting for review. */
  reviewCount: number;
  onPress?: () => void;
  testID?: string;
};

function reviewText(count: number): string {
  return count === 1 ? '1 pago por revisar' : `${count} pagos por revisar`;
}

/**
 * Google Wallet status on a featured gradient surface: connection state and how many
 * payments wait for review. Pressable when it leads somewhere (Inicio → Google Wallet).
 */
export function WalletConnectionCard({
  connection,
  reviewCount,
  onPress,
  testID,
}: WalletConnectionCardProps) {
  const theme = useAppTheme();
  const copy = CONNECTION_COPY[connection];
  const showReview = connection !== 'unsupported' && reviewCount > 0;
  const label = [copy.title, showReview ? reviewText(reviewCount) : copy.message]
    .filter(Boolean)
    .join('. ');

  const content = (
    <>
      <View
        style={[
          styles.badge,
          { backgroundColor: withAlpha(theme.colors.onFeatured, 0.18) },
        ]}
      >
        <Icon name="contactless" size="lg" color="onFeatured" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" color="onFeatured">
          {copy.title}
        </AppText>
        <AppText variant="caption" color="onFeaturedMuted">
          {showReview ? reviewText(reviewCount) : copy.message}
        </AppText>
      </View>
      {onPress && <Icon name="chevronRight" size="md" color="onFeatured" />}
    </>
  );

  const surface = [
    styles.card,
    {
      backgroundColor: theme.walletCardFaces.blue.solid,
      backgroundImage: theme.primaryGradient,
    },
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={surface} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre los pagos automáticos"
      onPress={onPress}
      style={({ pressed }) => [...surface, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  badge: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
});
