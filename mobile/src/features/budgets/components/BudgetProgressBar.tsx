import { StyleSheet, View } from 'react-native';
import { radius, spacing, useAppTheme } from '../../../shared/theme';
import type { BudgetProgress } from '../domain/types';
import {
  BUDGET_STATUS_VISUALS,
  percentUsed,
  spokenPercentUsed,
} from './budgetPresentation';

type BudgetProgressBarProps = {
  progress: BudgetProgress;
  testID?: string;
};

/**
 * How much of the limit is spent. The fill stops at the full width when exceeded; the
 * real percentage (e.g. 125%) is in the text and in the accessibility value.
 */
export function BudgetProgressBar({
  progress,
  testID,
}: BudgetProgressBarProps) {
  const theme = useAppTheme();
  const percent = percentUsed(progress);
  const fill = Math.min(percent, 100);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Presupuesto usado"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(fill),
        text: spokenPercentUsed(progress),
      }}
      style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${fill}%`,
            backgroundColor:
              theme.colors[BUDGET_STATUS_VISUALS[progress.status].color],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
