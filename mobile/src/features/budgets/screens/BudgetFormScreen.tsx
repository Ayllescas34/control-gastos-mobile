import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import { appConfig } from '../../../core/config/appConfig';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import type { EntityId } from '../../../shared/domain';
import { spacing } from '../../../shared/theme';
import { BudgetForm } from '../components/BudgetForm';
import {
  budgetToFormValues,
  emptyBudgetForm,
} from '../components/budgetFormModel';
import { describeBudgetsError } from '../components/budgetMessages';
import { BudgetNotAvailableError } from '../domain/budgetErrors';
import {
  useBudgetFormData,
  useBudgetRepositories,
  type BudgetFormData,
} from '../hooks/budgetHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'BudgetForm'>;

/** Creates a budget (optionally for a preselected category) or edits and archives one. */
export function BudgetFormScreen({ navigation, route }: Props) {
  const budgetId = route.params?.budgetId;
  const categoryId = route.params?.categoryId ?? null;
  const { resource, reload } = useBudgetFormData(budgetId);
  const repositories = useBudgetRepositories();
  const [archiving, setArchiving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: budgetId ? 'Editar presupuesto' : 'Nuevo presupuesto',
    });
  }, [navigation, budgetId]);

  const onDone = () => navigation.goBack();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando presupuesto" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar el presupuesto"
        message={describeBudgetsError(resource.error)}
      >
        <Button
          testID="budget-form-retry"
          title="Reintentar"
          onPress={reload}
        />
      </EmptyState>
    );
  }
  if (resource.data === null) {
    return (
      <EmptyState
        icon="info"
        title="Presupuesto no disponible"
        message="El presupuesto no existe o fue archivado."
      >
        <Button title="Volver" onPress={onDone} />
      </EmptyState>
    );
  }

  const data: BudgetFormData = resource.data;
  const { editing } = data;

  if (!editing) {
    const currency = appConfig.defaultCurrency;
    const preselected = data.expenseCategories.some(
      category =>
        category.id === categoryId &&
        !data.budgets.some(
          budget =>
            budget.categoryId === categoryId && budget.currency === currency,
        ),
    )
      ? categoryId
      : null;
    return (
      <Screen>
        <BudgetForm
          initialValues={emptyBudgetForm(preselected)}
          categories={data.expenseCategories}
          budgets={data.budgets}
          currency={currency}
          submitLabel="Crear presupuesto"
          onSubmit={async input => {
            await repositories.budgets.create(input);
            onDone();
          }}
        />
      </Screen>
    );
  }

  const { budget } = editing;

  async function archive(id: EntityId) {
    setArchiving(true);
    try {
      await repositories.budgets.softDelete(id);
      onDone();
    } catch (error) {
      console.error('Archive budget failed', error);
      setArchiving(false);
      Alert.alert(
        'No se pudo archivar el presupuesto',
        describeBudgetsError(error),
      );
    }
  }

  function confirmArchive() {
    Alert.alert(
      '¿Archivar presupuesto?',
      'Dejará de aparecer en tus presupuestos. Tus movimientos no cambian.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: () => archive(budget.id),
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <BudgetForm
          initialValues={budgetToFormValues(budget)}
          categories={data.expenseCategories}
          budgets={data.budgets}
          editing={editing}
          currency={budget.currency}
          submitLabel="Guardar cambios"
          onSubmit={async input => {
            const updated = await repositories.budgets.update(budget.id, {
              amountMinor: input.amountMinor,
            });
            if (!updated) {
              throw new BudgetNotAvailableError();
            }
            onDone();
          }}
        />
        <Button
          testID="budget-archive"
          title="Archivar presupuesto"
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
  content: {
    gap: spacing.md,
  },
});
