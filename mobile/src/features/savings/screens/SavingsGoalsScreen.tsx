import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../shared/components';
import type { EntityId } from '../../../shared/domain';
import { todayLocalDate } from '../../../shared/lib/dates';
import { describeSavingsError } from '../components/savingsMessages';
import { SavingsGoalListItem } from '../components/SavingsGoalListItem';
import { useSavingsOverview } from '../hooks/savingsHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'SavingsGoals'>;

/**
 * Active savings goals with what their accounts hold now (real SQLite balances). Reloads on
 * focus (after creating, editing, archiving or registering movements).
 */
export function SavingsGoalsScreen({ navigation }: Props) {
  const { resource, reload } = useSavingsOverview();

  const create = () => navigation.navigate('SavingsGoalForm');
  const edit = (goalId: EntityId) =>
    navigation.navigate('SavingsGoalForm', { goalId });

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando metas de ahorro" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus metas de ahorro"
        message={describeSavingsError(resource.error)}
      >
        <Button testID="savings-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { overview, accounts } = resource.data;

  if (overview.goals.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="Aún no tienes metas de ahorro"
        message="Elige una cuenta y cuánto quieres tener en ella. Tu avance es el saldo real de la cuenta."
      >
        <Button
          testID="savings-empty-add"
          title="Crear meta"
          onPress={create}
        />
      </EmptyState>
    );
  }

  const today = todayLocalDate();

  return (
    <Screen>
      <SectionHeader
        title="Metas de ahorro"
        action={{
          testID: 'savings-add',
          label: 'Agregar meta',
          icon: 'add',
          onPress: create,
        }}
      />
      <Card>
        {overview.goals.map(progress => (
          <SavingsGoalListItem
            key={progress.goal.id}
            progress={progress}
            account={accounts.get(progress.goal.accountId)}
            today={today}
            onEdit={edit}
          />
        ))}
      </Card>
    </Screen>
  );
}
