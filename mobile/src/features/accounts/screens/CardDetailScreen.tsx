import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  AppText,
  Button,
  Card,
  DetailRow,
  EmptyState,
  ListItem,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { spacing } from '../../../shared/theme';
import { describeAccountsError } from '../components/accountMessages';
import {
  ACCOUNT_TYPE_VISUALS,
  cardKindLabel,
  cardNetworkLabel,
  maskLast4,
} from '../components/accountVisuals';
import { useCardDetail } from '../hooks/accountQueries';
import { useAccountRepositories } from '../hooks/useAccountRepositories';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

/** Card identification only: alias, last four digits, network and account. */
export function CardDetailScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const { resource, reload } = useCardDetail(cardId);
  const repositories = useAccountRepositories();
  const [archiving, setArchiving] = useState(false);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando tarjeta" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la tarjeta"
        message={describeAccountsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }
  if (resource.data === null) {
    return (
      <EmptyState
        icon="info"
        title="Tarjeta no disponible"
        message="La tarjeta no existe o fue archivada."
      >
        <Button title="Volver" onPress={() => navigation.goBack()} />
      </EmptyState>
    );
  }

  const { card, account } = resource.data;

  async function archive() {
    setArchiving(true);
    try {
      await repositories.cards.softDelete(card.id);
      navigation.goBack();
    } catch (error) {
      console.error('Archive card failed', error);
      setArchiving(false);
      Alert.alert(
        'No se pudo archivar la tarjeta',
        describeAccountsError(error),
      );
    }
  }

  function confirmArchive() {
    Alert.alert(
      '¿Archivar tarjeta?',
      `"${card.alias}" dejará de aparecer entre tus tarjetas activas. Sus datos se conservan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: archive },
      ],
    );
  }

  return (
    <Screen>
      <Card style={styles.summary}>
        <View style={styles.titleRow}>
          <IconBadge name="creditCard" variant="primary" size="lg" />
          <View style={styles.titleText}>
            <AppText variant="title" accessibilityRole="header">
              {card.alias}
            </AppText>
            <AppText
              variant="amountLarge"
              accessibilityLabel={`Terminada en ${card.last4}`}
            >
              {maskLast4(card.last4)}
            </AppText>
          </View>
        </View>
        {account && (
          <AppText variant="label" color="textSecondary">
            {cardKindLabel(account.type)}
          </AppText>
        )}
      </Card>

      <Card>
        <DetailRow label="Red" value={cardNetworkLabel(card.network)} />
        <DetailRow label="Últimos 4 dígitos" value={card.last4} />
      </Card>

      {account && (
        <Card>
          <ListItem
            testID="card-account-link"
            title={account.name}
            subtitle={`Cuenta · ${ACCOUNT_TYPE_VISUALS[account.type].label}`}
            leading={
              <IconBadge
                name={ACCOUNT_TYPE_VISUALS[account.type].icon}
                variant="neutral"
              />
            }
            onPress={() =>
              navigation.navigate('AccountDetail', { accountId: account.id })
            }
            accessibilityHint="Abre el detalle de la cuenta"
          />
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          testID="card-edit"
          title="Editar tarjeta"
          variant="secondary"
          onPress={() => navigation.navigate('CardForm', { cardId: card.id })}
        />
        <Button
          testID="card-archive"
          title="Archivar tarjeta"
          variant="danger"
          loading={archiving}
          accessibilityHint="Pide confirmación antes de archivar"
          onPress={confirmArchive}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleText: {
    flex: 1,
    gap: spacing.xxs,
  },
  actions: {
    gap: spacing.md,
  },
});
