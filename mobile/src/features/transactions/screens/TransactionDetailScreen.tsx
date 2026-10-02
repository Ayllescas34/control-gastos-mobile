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
} from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import { spacing } from '../../../shared/theme';
import { describeTransactionsError } from '../components/transactionMessages';
import { describeTransaction } from '../components/transactionPresentation';
import { TRANSACTION_TYPE_VISUALS } from '../components/transactionTypeVisuals';
import {
  useTransactionDetail,
  useTransactionRepositories,
} from '../hooks/transactionHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

const ARCHIVED = ' (archivada)';

/** Name of a referenced entity, flagged when archived (past movements keep it). */
function nameOf(
  entity: { name: string; deletedAt: string | null } | undefined,
): string {
  if (!entity) {
    return 'No disponible';
  }
  return entity.deletedAt === null ? entity.name : `${entity.name}${ARCHIVED}`;
}

export function TransactionDetailScreen({ navigation, route }: Props) {
  const { transactionId } = route.params;
  const { resource, reload } = useTransactionDetail(transactionId);
  const repositories = useTransactionRepositories();
  const [archiving, setArchiving] = useState(false);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando movimiento" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar el movimiento"
        message={describeTransactionsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }
  if (resource.data === null) {
    return (
      <EmptyState
        icon="info"
        title="Movimiento no disponible"
        message="El movimiento no existe o fue archivado."
      >
        <Button title="Volver" onPress={() => navigation.goBack()} />
      </EmptyState>
    );
  }

  const { transaction, references } = resource.data;
  const visual = TRANSACTION_TYPE_VISUALS[transaction.type];
  const view = describeTransaction(transaction, references);
  const card = references.card(transaction.cardId);
  const category = references.category(transaction.categoryId);

  async function archive() {
    setArchiving(true);
    try {
      await repositories.transactions.softDelete(transaction.id);
      navigation.goBack();
    } catch (error) {
      console.error('Archive transaction failed', error);
      setArchiving(false);
      Alert.alert(
        'No se pudo archivar el movimiento',
        describeTransactionsError(error),
      );
    }
  }

  function confirmArchive() {
    Alert.alert(
      '¿Archivar movimiento?',
      'Dejará de aparecer en tus movimientos y ya no contará en los saldos de tus cuentas. Sus datos se conservan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: archive },
      ],
    );
  }

  return (
    <Screen>
      <Card style={styles.summary}>
        <View style={styles.typeRow}>
          <IconBadge name={view.icon} variant={view.tone} />
          <AppText variant="label" color="textSecondary">
            {visual.label}
          </AppText>
        </View>
        <AppText variant="title" accessibilityRole="header">
          {view.title}
        </AppText>
        <AppText variant="amountHero" color={view.amountColor}>
          {view.amount}
        </AppText>
      </Card>

      <Card>
        {transaction.type === 'transfer' ? (
          <>
            <DetailRow
              label="Desde"
              value={nameOf(references.account(transaction.accountId))}
            />
            <DetailRow
              label="Hacia"
              value={nameOf(references.account(transaction.toAccountId))}
            />
          </>
        ) : (
          <>
            <DetailRow
              label="Cuenta"
              value={nameOf(references.account(transaction.accountId))}
            />
            <DetailRow
              label="Categoría"
              value={category ? nameOf(category) : 'Sin categoría'}
            />
          </>
        )}
        {card && (
          <DetailRow
            label="Tarjeta"
            value={`${card.alias} •••• ${card.last4}${
              card.deletedAt === null ? '' : ARCHIVED
            }`}
          />
        )}
        <DetailRow
          label="Fecha"
          value={formatLocalDate(
            transaction.localDate,
            "d 'de' MMMM 'de' yyyy",
          )}
        />
        {transaction.type !== 'transfer' && (
          <DetailRow
            label={transaction.type === 'expense' ? 'Comercio' : 'Origen'}
            value={transaction.payee ?? '—'}
          />
        )}
        <DetailRow label="Descripción" value={transaction.description ?? '—'} />
        <DetailRow label="Nota" value={transaction.note ?? '—'} />
        <DetailRow label="Moneda" value={transaction.currency} />
      </Card>

      <View style={styles.actions}>
        <Button
          testID="transaction-edit"
          title="Editar movimiento"
          variant="secondary"
          onPress={() =>
            navigation.navigate('EditTransaction', {
              transactionId: transaction.id,
            })
          }
        />
        <Button
          testID="transaction-archive"
          title="Archivar movimiento"
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
    gap: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
