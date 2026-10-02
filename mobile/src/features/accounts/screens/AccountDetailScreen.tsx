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
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import {
  ARCHIVE_BLOCKED_MESSAGE,
  describeAccountsError,
} from '../components/accountMessages';
import { ACCOUNT_TYPE_VISUALS } from '../components/accountVisuals';
import { CardListItem } from '../components/CardListItem';
import { useAccountDetail } from '../hooks/accountQueries';
import { useAccountRepositories } from '../hooks/useAccountRepositories';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountDetail'>;

export function AccountDetailScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const { resource, reload } = useAccountDetail(accountId);
  const repositories = useAccountRepositories();
  const [archiving, setArchiving] = useState(false);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando cuenta" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la cuenta"
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
        title="Cuenta no disponible"
        message="La cuenta no existe o fue archivada."
      >
        <Button title="Volver" onPress={() => navigation.goBack()} />
      </EmptyState>
    );
  }

  const { account, cards, balanceMinor } = resource.data;
  const visual = ACCOUNT_TYPE_VISUALS[account.type];

  async function archive() {
    setArchiving(true);
    try {
      await repositories.accounts.softDelete(account.id);
      navigation.goBack();
    } catch (error) {
      console.error('Archive account failed', error);
      setArchiving(false);
      Alert.alert(
        'No se pudo archivar la cuenta',
        describeAccountsError(error),
      );
    }
  }

  function confirmArchive() {
    if (cards.length > 0) {
      // Archiving never cascades: say why it is not possible instead of trying.
      Alert.alert('No se puede archivar', ARCHIVE_BLOCKED_MESSAGE);
      return;
    }
    Alert.alert(
      '¿Archivar cuenta?',
      `"${account.name}" dejará de aparecer entre tus cuentas activas. Sus datos se conservan.`,
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
          <IconBadge name={visual.icon} variant="primary" size="lg" />
          <View style={styles.titleText}>
            <AppText variant="title" accessibilityRole="header">
              {account.name}
            </AppText>
            <AppText variant="label" color="textSecondary">
              {visual.label} · {account.currency}
            </AppText>
          </View>
        </View>
        <View>
          <AppText variant="label" color="textSecondary">
            Saldo actual
          </AppText>
          <AppText variant="amountLarge">
            {formatMoney(balanceMinor, account.currency)}
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary">
          Saldo inicial más tus movimientos registrados.
        </AppText>
      </Card>

      <Card>
        <DetailRow label="Tipo" value={visual.label} />
        <DetailRow label="Moneda" value={account.currency} />
        <DetailRow
          label="Saldo inicial"
          value={formatMoney(account.initialBalanceMinor, account.currency)}
        />
        <DetailRow label="Estado" value="Activa" />
      </Card>

      <SectionHeader
        title="Tarjetas"
        action={{
          testID: 'account-add-card',
          label: 'Agregar tarjeta',
          icon: 'add',
          accessibilityHint: `Agrega una tarjeta a ${account.name}`,
          onPress: () =>
            navigation.navigate('CardForm', { accountId: account.id }),
        }}
      />
      <Card>
        {cards.length === 0 ? (
          <AppText color="textSecondary">
            Esta cuenta no tiene tarjetas.
          </AppText>
        ) : (
          cards.map(card => (
            <CardListItem
              key={card.id}
              card={card}
              onPress={cardId => navigation.navigate('CardDetail', { cardId })}
            />
          ))
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          testID="account-edit"
          title="Editar cuenta"
          variant="secondary"
          onPress={() =>
            navigation.navigate('AccountForm', { accountId: account.id })
          }
        />
        <Button
          testID="account-archive"
          title="Archivar cuenta"
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
    gap: spacing.lg,
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
