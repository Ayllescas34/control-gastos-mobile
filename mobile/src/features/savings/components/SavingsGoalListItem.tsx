import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import type { LocalDate } from '../../../shared/domain';
import { Icon, IconBadge, IconButton } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import { layout, spacing } from '../../../shared/theme';
import type { Account } from '../../accounts/domain/types';
import type { SavingsGoalProgress } from '../domain/types';
import { describeSavingsStatus } from './savingsMessages';
import {
  SAVINGS_STATUS_VISUALS,
  describeTargetDate,
  formatPercentSaved,
  spokenPercentSaved,
} from './savingsPresentation';
import { SavingsProgressBar } from './SavingsProgressBar';

type SavingsGoalListItemProps = {
  progress: SavingsGoalProgress;
  /** The goal's account, for its name. */
  account: Account | undefined;
  /** Today's civil date, to mark a past target date. */
  today: LocalDate;
  onEdit: (goalId: string) => void;
};

const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

/**
 * One goal: name, saved of target, percentage, progress bar, account, target date and
 * status in words. The figures are announced as one sentence; editing is its own button.
 */
export const SavingsGoalListItem = memo(function SavingsGoalListItemView({
  progress,
  account,
  today,
  onEdit,
}: SavingsGoalListItemProps) {
  const { goal, savedMinor, currency, status } = progress;
  const saved = formatMoney(savedMinor, currency);
  const target = formatMoney(goal.targetAmountMinor, currency);
  const accountName = account?.name ?? 'Cuenta';
  const statusText = describeSavingsStatus(progress);
  const dateText =
    goal.targetDate === null
      ? null
      : describeTargetDate(goal.targetDate, today);
  const visual = SAVINGS_STATUS_VISUALS[status];

  const sentence = [
    `${goal.name}, ${saved} de ${target}, ${spokenPercentSaved(
      progress,
    )}, ${lowerFirst(statusText)}, cuenta ${accountName}.`,
    dateText ? `${dateText}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View testID={`savings-goal-${goal.id}`} style={styles.item}>
      <View style={styles.header}>
        <View
          style={styles.summary}
          accessible
          accessibilityLabel={sentence}
          testID={`savings-goal-${goal.id}-summary`}
        >
          <View style={styles.titleRow}>
            <IconBadge
              name="wallet"
              variant={status === 'reached' ? 'income' : 'primary'}
            />
            <View style={styles.title}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {goal.name}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Cuenta: {accountName}
              </AppText>
              {dateText !== null && (
                <AppText variant="caption" color="textSecondary">
                  {dateText}
                </AppText>
              )}
            </View>
          </View>

          <View style={styles.figures}>
            <AppText variant="amount">
              {saved} / {target}
            </AppText>
            <AppText variant="label">{formatPercentSaved(progress)}</AppText>
          </View>

          <View style={styles.statusRow}>
            <Icon name={visual.icon} size="sm" color={visual.color} />
            <AppText variant="label" color={visual.color} style={styles.status}>
              {statusText}
            </AppText>
          </View>
        </View>

        <IconButton
          testID={`savings-goal-${goal.id}-edit`}
          icon="edit"
          accessibilityLabel={`Editar meta ${goal.name}`}
          accessibilityHint="Abre la meta para cambiarla o archivarla"
          onPress={() => onEdit(goal.id)}
        />
      </View>

      <SavingsProgressBar
        testID={`savings-goal-${goal.id}-progress`}
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
    alignItems: 'baseline',
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
