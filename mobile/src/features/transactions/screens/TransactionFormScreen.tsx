import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { TransactionForm } from '../components/TransactionForm';
import {
  emptyTransactionForm,
  transactionToFormValues,
} from '../components/transactionFormModel';
import {
  describeTransactionsError,
  TransactionNotAvailableError,
} from '../components/transactionMessages';
import type { TransactionType } from '../domain/types';
import {
  useTransactionFormData,
  useTransactionRepositories,
} from '../hooks/transactionHooks';

type Props =
  | NativeStackScreenProps<RootStackParamList, 'NewTransaction'>
  | NativeStackScreenProps<RootStackParamList, 'EditTransaction'>;

/**
 * Creates a movement (the "+" action: expense, income or transfer) or edits one. Saves
 * through the repository, which validates against the stored accounts, cards and
 * categories, then goes back.
 */
export function TransactionFormScreen({ navigation, route }: Props) {
  const transactionId =
    route.name === 'EditTransaction' ? route.params.transactionId : undefined;
  const initialType: TransactionType | null =
    route.name === 'NewTransaction' ? route.params?.type ?? null : null;
  const { resource, reload } = useTransactionFormData(transactionId);
  const repositories = useTransactionRepositories();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: transactionId ? 'Editar movimiento' : 'Nuevo movimiento',
    });
  }, [navigation, transactionId]);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus datos"
        message={describeTransactionsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { references, transaction } = resource.data;
  if (transactionId && !transaction) {
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
  if (!transaction && references.activeAccounts.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="Primero crea una cuenta"
        message="Cada movimiento pertenece a una cuenta: banco, efectivo, ahorros o crédito."
      >
        <Button
          testID="transaction-add-account"
          title="Agregar cuenta"
          onPress={() => navigation.navigate('AccountForm')}
        />
      </EmptyState>
    );
  }

  // With a single account there is nothing to choose.
  const defaultAccountId =
    references.activeAccounts.length === 1
      ? references.activeAccounts[0].id
      : null;

  return (
    <Screen>
      <TransactionForm
        initialValues={
          transaction
            ? transactionToFormValues(transaction)
            : emptyTransactionForm(initialType, defaultAccountId)
        }
        references={references}
        previous={transaction}
        submitLabel={transaction ? 'Guardar cambios' : 'Guardar movimiento'}
        onSubmit={async input => {
          if (transaction) {
            const updated = await repositories.transactions.update(
              transaction.id,
              input,
            );
            if (!updated) {
              throw new TransactionNotAvailableError();
            }
          } else {
            await repositories.transactions.create(input);
          }
          navigation.goBack();
        }}
      />
    </Screen>
  );
}
