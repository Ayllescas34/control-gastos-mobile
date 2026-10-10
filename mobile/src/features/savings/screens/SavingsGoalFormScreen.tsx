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
import { SavingsGoalForm } from '../components/SavingsGoalForm';
import {
  emptySavingsGoalForm,
  savingsGoalToFormValues,
} from '../components/savingsGoalFormModel';
import { describeSavingsError } from '../components/savingsMessages';
import { SavingsGoalNotAvailableError } from '../domain/savingsGoalErrors';
import {
  useSavingsGoalFormData,
  useSavingsRepositories,
  type SavingsGoalFormData,
} from '../hooks/savingsHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGoalForm'>;

/** Creates a savings goal or edits and archives one ("completing" a goal archives it). */
export function SavingsGoalFormScreen({ navigation, route }: Props) {
  const goalId = route.params?.goalId;
  const { resource, reload } = useSavingsGoalFormData(goalId);
  const repositories = useSavingsRepositories();
  const [archiving, setArchiving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: goalId ? 'Editar meta' : 'Nueva meta',
    });
  }, [navigation, goalId]);

  const onDone = () => navigation.goBack();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando meta" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la meta"
        message={describeSavingsError(resource.error)}
      >
        <Button
          testID="savings-goal-form-retry"
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
        title="Meta no disponible"
        message="La meta no existe o fue archivada."
      >
        <Button title="Volver" onPress={onDone} />
      </EmptyState>
    );
  }

  const data: SavingsGoalFormData = resource.data;
  const { editing } = data;

  if (!editing) {
    if (data.accounts.length === 0) {
      return (
        <EmptyState
          icon="wallet"
          title="No tienes cuentas para ahorrar"
          message="Una meta mide el saldo de una cuenta de ahorro, banco, efectivo u otra (no de crédito). Crea una cuenta primero."
        >
          <Button
            testID="savings-goal-create-account"
            title="Crear cuenta"
            onPress={() => navigation.navigate('AccountForm')}
          />
        </EmptyState>
      );
    }
    return (
      <Screen>
        <SavingsGoalForm
          initialValues={emptySavingsGoalForm()}
          accounts={data.accounts}
          goals={data.goals}
          submitLabel="Crear meta"
          onSubmit={async input => {
            await repositories.goals.create(input);
            onDone();
          }}
        />
      </Screen>
    );
  }

  const { goal } = editing;

  async function archive(id: EntityId) {
    setArchiving(true);
    try {
      await repositories.goals.softDelete(id);
      onDone();
    } catch (error) {
      console.error('Archive savings goal failed', error);
      setArchiving(false);
      Alert.alert('No se pudo archivar la meta', describeSavingsError(error));
    }
  }

  function confirmArchive() {
    Alert.alert(
      '¿Ya cumpliste esta meta?',
      'Archivarla la quitará de tu lista de metas activas. Tu cuenta, su saldo y tus movimientos no cambian.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: () => archive(goal.id),
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <SavingsGoalForm
          initialValues={savingsGoalToFormValues(
            goal,
            editing.account?.currency ?? appConfig.defaultCurrency,
          )}
          accounts={data.accounts}
          goals={data.goals}
          editing={editing}
          submitLabel="Guardar cambios"
          onSubmit={async input => {
            const updated = await repositories.goals.update(goal.id, {
              name: input.name,
              targetAmountMinor: input.targetAmountMinor,
              targetDate: input.targetDate,
            });
            if (!updated) {
              throw new SavingsGoalNotAvailableError();
            }
            onDone();
          }}
        />
        <Button
          testID="savings-goal-archive"
          title="Archivar meta"
          variant="danger"
          loading={archiving}
          accessibilityHint="Pide confirmación antes de archivar la meta"
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
