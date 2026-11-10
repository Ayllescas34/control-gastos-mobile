import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ListItem,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { spacing } from '../../../shared/theme';
import { openWalletAccessSettings } from '../../../core/native/walletCaptures';
// By module, not the transactions feature index, to keep features free of import cycles.
import { TransactionListItem } from '../../transactions/components/TransactionListItem';
import { BankSendersCard } from '../components/BankSendersCard';
import { WalletConnectionCard } from '../components/WalletConnectionCard';
import { describeCapture } from '../components/walletPresentation';
import { useWalletInbox, useWalletRepository } from '../hooks/walletHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'Wallet'>;

const PRIVACY_NOTE =
  'Solo se leen las notificaciones de Google Wallet y los SMS de los remitentes de tu banco que configures. Los demás mensajes se descartan sin guardarse, y todo se queda en este teléfono.';

/**
 * Automatic capture (Google Wallet and bank SMS): connection, bank senders and the review inbox. Payments matched to
 * a card are already movements marked "por revisar"; the rest wait here for an account
 * (docs/google-wallet.md).
 */
export function WalletScreen({ navigation }: Props) {
  const { resource, reload } = useWalletInbox();
  const captures = useWalletRepository();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando Google Wallet" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar Google Wallet"
        message="Tus datos siguen guardados en el dispositivo. Intenta de nuevo."
      >
        <Button testID="wallet-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { connection, pendingTransactions, references } = resource.data;
  const newCaptures = resource.data.captures;
  const reviewCount = newCaptures.length + pendingTransactions.length;

  async function connect() {
    if (!(await openWalletAccessSettings())) {
      Alert.alert(
        'No se pudo abrir Ajustes',
        'Abre Ajustes → Notificaciones → Acceso a notificaciones y activa Control de Gastos.',
      );
    }
  }

  function confirmDismiss(captureId: string) {
    Alert.alert(
      '¿Descartar este pago?',
      'No se registrará como movimiento. Úsalo para pagos que ya registraste a mano.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            try {
              await captures.dismiss(captureId);
            } catch (error) {
              console.error('Dismiss wallet capture failed', error);
              Alert.alert('No se pudo descartar el pago', 'Intenta de nuevo.');
            }
            reload();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <WalletConnectionCard
        testID="wallet-connection"
        connection={connection}
        reviewCount={reviewCount}
      />
      {connection === 'disconnected' && (
        <Button
          testID="wallet-connect"
          title="Activar acceso a notificaciones"
          onPress={connect}
          accessibilityHint="Abre los ajustes del sistema"
        />
      )}

      {newCaptures.length > 0 && (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Por registrar
          </AppText>
          <AppText variant="caption" color="textSecondary">
            No supimos a qué cuenta pertenecen: ninguna tarjeta tiene esos
            últimos 4 dígitos o ninguna cuenta tiene ese identificador del
            banco. Elige la cuenta al registrarlos.
          </AppText>
          {newCaptures.map(capture => {
            const view = describeCapture(capture);
            return (
              <View key={capture.id} style={styles.capture}>
                <ListItem
                  testID={`wallet-capture-${capture.id}`}
                  title={view.title}
                  subtitle={view.subtitle}
                  leading={<IconBadge name={view.icon} variant={view.tone} />}
                  trailing={
                    <AppText variant="amount" color={view.amountColor}>
                      {view.amount}
                    </AppText>
                  }
                  accessibilityLabel={view.accessibilityLabel}
                />
                <View style={styles.captureActions}>
                  <View style={styles.action}>
                    <Button
                      testID={`wallet-capture-register-${capture.id}`}
                      title="Registrar"
                      onPress={() =>
                        navigation.navigate('RegisterWalletCapture', {
                          captureId: capture.id,
                        })
                      }
                    />
                  </View>
                  <View style={styles.action}>
                    <Button
                      testID={`wallet-capture-dismiss-${capture.id}`}
                      title="Descartar"
                      variant="secondary"
                      onPress={() => confirmDismiss(capture.id)}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {connection !== 'unsupported' && <BankSendersCard />}

      {pendingTransactions.length > 0 && (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Registrados automáticamente
          </AppText>
          <AppText variant="caption" color="textSecondary">
            Ya cuentan en tus saldos. Ábrelos para elegir la categoría o
            confirmarlos.
          </AppText>
          {pendingTransactions.map(transaction => (
            <TransactionListItem
              key={transaction.id}
              transaction={transaction}
              references={references}
              onPress={transactionId =>
                navigation.navigate('TransactionDetail', { transactionId })
              }
            />
          ))}
        </Card>
      )}

      {reviewCount === 0 && connection !== 'unsupported' && (
        <Card>
          <View style={styles.empty}>
            <IconBadge name="inbox" variant="neutral" />
            <AppText color="textSecondary" style={styles.emptyText}>
              No tienes pagos por revisar.
            </AppText>
          </View>
        </Card>
      )}

      <AppText variant="caption" color="textSecondary">
        {PRIVACY_NOTE}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  capture: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  captureActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    flex: 1,
  },
});
