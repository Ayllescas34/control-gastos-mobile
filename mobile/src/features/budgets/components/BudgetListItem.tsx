import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { Icon, IconBadge, IconButton } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import { layout, spacing } from '../../../shared/theme';
import type { Category } from '../../categories/domain/types';
import type { BudgetProgress } from '../domain/types';
import { describeBudgetStatus } from './budgetMessages';
import {
  BUDGET_STATUS_VISUALS,
  formatPercentUsed,
  spokenPercentUsed,
} from './budgetPresentation';
import { BudgetProgressBar } from './BudgetProgressBar';

type BudgetListItemProps = {
  progress: BudgetProgress;
  /** The budget's category; archived ones are still shown. */
  category: Category | undefined;
  onEdit: (budgetId: string) => void;
};

/**
 * One budget: category, limit, spent, available, percentage, status in words and a
 * progress bar. The figures are announced as one sentence; editing is its own button.
 */
export const BudgetListItem = memo(function BudgetListItemView({
  progress,
  category,
  onEdit,
}: BudgetListItemProps) {
  const { budget, spentMinor, remainingMinor, status } = progress;
  const name = category?.name ?? 'Categoría';
  const archived = category?.deletedAt != null;
  const limit = formatMoney(budget.amountMinor, budget.currency);
  const spent = formatMoney(spentMinor, budget.currency);
  const available = formatMoney(remainingMinor, budget.currency);
  const statusText = describeBudgetStatus(progress);
  const visual = BUDGET_STATUS_VISUALS[status];

  const sentence = [
    `${name}, gastado ${spent} de ${limit}, ${spokenPercentUsed(
      progress,
    )}, disponible ${available}.`,
    `${statusText}.`,
    archived ? 'Categoría archivada.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View testID={`budget-${budget.id}`} style={styles.item}>
      <View style={styles.header}>
        <View
          style={styles.summary}
          accessible
          accessibilityLabel={sentence}
          testID={`budget-${budget.id}-summary`}
        >
          <View style={styles.titleRow}>
            <IconBadge
              name={category?.icon ?? 'category'}
              variant={archived ? 'neutral' : 'expense'}
            />
            <View style={styles.title}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {limit} presupuesto
              </AppText>
              {archived && (
                <AppText variant="caption" color="warning">
                  Categoría archivada
                </AppText>
              )}
            </View>
          </View>

          <View style={styles.figures}>
            <AppText variant="amount">{spent} gastado</AppText>
            <AppText
              variant="amount"
              color={remainingMinor < 0 ? 'error' : 'textSecondary'}
            >
              {available} disponible
            </AppText>
          </View>

          <View style={styles.statusRow}>
            <Icon name={visual.icon} size="sm" color={visual.color} />
            <AppText variant="label" color={visual.color} style={styles.status}>
              {statusText}
            </AppText>
            <AppText variant="label">{formatPercentUsed(progress)}</AppText>
          </View>
        </View>

        <IconButton
          testID={`budget-${budget.id}-edit`}
          icon="edit"
          accessibilityLabel={`Editar presupuesto de ${name}`}
          accessibilityHint="Abre el presupuesto para cambiar el monto o archivarlo"
          onPress={() => onEdit(budget.id)}
        />
      </View>

      <BudgetProgressBar
        testID={`budget-${budget.id}-progress`}
        progress={progress}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  item: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  summary: {
    flex: 1,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.listItemGap,
  },
  title: {
    flex: 1,
    gap: spacing.xxs,
  },
  figures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  status: {
    flex: 1,
  },
});
