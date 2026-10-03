import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import { appConfig } from '../../../core/config/appConfig';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ListItem,
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../shared/components';
import type { EntityId } from '../../../shared/domain';
import { IconBadge } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import type { Category } from '../../categories/domain/types';
// By module: the month label is shared presentation of the current period.
import { formatPeriodLabel } from '../../dashboard/components/dashboardPresentation';
import { describeBudgetsError } from '../components/budgetMessages';
import { BudgetListItem } from '../components/BudgetListItem';
import type { UnbudgetedSpending } from '../domain/types';
import { useBudgetOverview } from '../hooks/budgetHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

/**
 * Active budgets of the current month with what they spent (real SQLite sums), then the
 * month's spending without a budget. Reloads on focus (after creating, editing, archiving
 * or registering movements).
 */
export function BudgetsScreen({ navigation }: Props) {
  const { resource, reload } = useBudgetOverview();

  const create = (categoryId?: EntityId) =>
    navigation.navigate('BudgetForm', categoryId ? { categoryId } : undefined);
  const edit = (budgetId: EntityId) =>
    navigation.navigate('BudgetForm', { budgetId });

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando presupuestos" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus presupuestos"
        message={describeBudgetsError(resource.error)}
      >
        <Button testID="budgets-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { overview, categories } = resource.data;
  const { budgets, unbudgeted } = overview;

  if (budgets.length === 0 && unbudgeted.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="Aún no tienes presupuestos"
        message="Define cuánto quieres gastar cada mes en una categoría y sigue tu avance con tus movimientos reales."
      >
        <Button
          testID="budgets-empty-add"
          title="Crear presupuesto"
          onPress={() => create()}
        />
      </EmptyState>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={formatPeriodLabel(overview.period.from)}
        action={{
          testID: 'budgets-add',
          label: 'Agregar presupuesto',
          icon: 'add',
          onPress: () => create(),
        }}
      />

      <Card>
        {budgets.length === 0 ? (
          <View style={styles.inlineEmpty}>
            <AppText color="textSecondary">Aún no tienes presupuestos.</AppText>
            <Button
              testID="budgets-empty-add"
              title="Crear presupuesto"
              onPress={() => create()}
            />
          </View>
        ) : (
          budgets.map(progress => (
            <BudgetListItem
              key={progress.budget.id}
              progress={progress}
              category={categories.get(progress.budget.categoryId)}
              onEdit={edit}
            />
          ))
        )}
      </Card>

      {unbudgeted.length > 0 && (
        <>
          <SectionHeader title="Sin presupuesto" />
          <Card>
            {unbudgeted.map(spending => (
              <UnbudgetedRow
                key={`${spending.categoryId ?? 'none'}-${spending.currency}`}
                spending={spending}
                category={
                  spending.categoryId === null
                    ? undefined
                    : categories.get(spending.categoryId)
                }
                onCreate={create}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

type UnbudgetedRowProps = {
  spending: UnbudgetedSpending;
  category: Category | undefined;
  onCreate: (categoryId: EntityId) => void;
};

/**
 * Spending of the month with no budget. Only an active category in the currency the app
 * creates budgets in (GTQ in V1) offers "Crear presupuesto"; archived categories and
 * uncategorized expenses are information only.
 */
function UnbudgetedRow({ spending, category, onCreate }: UnbudgetedRowProps) {
  const spent = formatMoney(spending.spentMinor, spending.currency);
  const archived = category?.deletedAt != null;
  const name = category?.name ?? 'Sin categoría';
  const note =
    spending.categoryId === null
      ? 'Los gastos sin categoría no tienen presupuesto'
      : archived
      ? 'Categoría archivada'
      : null;
  const canCreate =
    category !== undefined &&
    !archived &&
    spending.currency === appConfig.defaultCurrency;
  const id = `${spending.categoryId ?? 'none'}-${spending.currency}`;

  return (
    <View style={styles.unbudgeted}>
      <ListItem
        testID={`budgets-unbudgeted-${id}`}
        title={name}
        subtitle={[`${spent} gastado · ${spending.currency}`, note]
          .filter(Boolean)
          .join(' · ')}
        leading={
          <IconBadge
            name={category?.icon ?? 'category'}
            variant={category && !archived ? 'expense' : 'neutral'}
          />
        }
      />
      {canCreate && (
        <Button
          testID={`budgets-create-${id}`}
          title="Crear presupuesto"
          variant="secondary"
          accessibilityHint={`Crea un presupuesto mensual para ${name}`}
          onPress={() => onCreate(category.id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineEmpty: {
    gap: spacing.md,
  },
  unbudgeted: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
});
