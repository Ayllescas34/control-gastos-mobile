import { StyleSheet, View } from 'react-native';
import { radius, spacing, useAppTheme } from '../../../shared/theme';
import type { SavingsGoalProgress } from '../domain/types';
import {
  SAVINGS_STATUS_VISUALS,
  percentSaved,
  spokenPercentSaved,
} from './savingsPresentation';

type SavingsProgressBarProps = {
  progress: SavingsGoalProgress;
  testID?: string;
};

/**
 * How much of the target is saved. The fill stops at the full width when surpassed; the
 * real percentage (e.g. 125%) is in the text and in the accessibility value.
 */
export function SavingsProgressBar({
  progress,
  testID,
}: SavingsProgressBarProps) {
  const theme = useAppTheme();
  const fill = Math.min(percentSaved(progress), 100);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Avance de la meta"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(fill),
        text: spokenPercentSaved(progress),
      }}
      style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${fill}%`,
            backgroundColor:
              theme.colors[SAVINGS_STATUS_VISUALS[progress.status].color],
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
