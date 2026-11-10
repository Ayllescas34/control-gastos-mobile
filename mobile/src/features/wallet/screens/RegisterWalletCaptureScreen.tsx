import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useDatabase } from '../../../core/db';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
// By module, not the transactions feature index, to keep features free of import cycles.
import { TransactionForm } from '../../transactions/components/TransactionForm';
import { describeTransactionsError } from '../../transactions/components/transactionMessages';
import { captureToFormValues } from '../components/captureFormValues';
import { describeCapture } from '../components/walletPresentation';
import { registerWalletCapture } from '../data/walletCaptureRepository';
import { useCapturePrefill } from '../hooks/walletHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterWalletCapture'>;

/**
 * Turns a Google Wallet capture into a movement: the regular movement form, prefilled from
 * the notification. Saving creates the movement and links the capture in one transaction.
 */
export function RegisterWalletCaptureScreen({ navigation, route }: Props) {
  const { captureId } = route.params;
  const database = useDatabase();
  const { resource, reload } = useCapturePrefill(captureId);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando el pago" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar el pago"
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
        title="Pago no disponible"
        message="Este pago ya fue registrado o descartado."
      >
        <Button title="Volver" onPress={() => navigation.goBack()} />
      </EmptyState>
    );
  }

  const { capture, references, match, suggestedCategoryId, cashAccountId } =
    resource.data;
  if (references.activeAccounts.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="Primero crea una cuenta"
        message="Cada movimiento pertenece a una cuenta. Agrega la cuenta de la tarjeta que usas en Google Wallet."
      >
        <Button
          title="Agregar cuenta"
          onPress={() => navigation.navigate('AccountForm')}
        />
      </EmptyState>
    );
  }

  const view = describeCapture(capture);
  const defaultAccountId =
    references.activeAccounts.length === 1
      ? references.activeAccounts[0].id
      : null;

  return (
    <Screen>
      <Card>
        <AppText variant="caption" color="textSecondary">
          {view.origin}
        </AppText>
        <AppText variant="heading">{view.title}</AppText>
        <AppText variant="caption" color="textSecondary">
          {view.subtitle}
        </AppText>
      </Card>
      <TransactionForm
        initialValues={captureToFormValues(capture, {
          match,
          defaultAccountId,
          suggestedCategoryId,
          cashAccountId,
        })}
        references={references}
        previous={null}
        submitLabel="Registrar movimiento"
        onSubmit={async input => {
          await registerWalletCapture(database, capture.id, input);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}
