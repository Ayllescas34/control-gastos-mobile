import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { AppText } from './AppText';

type DetailRowProps = {
  label: string;
  value: string;
};

/** Label/value pair in a detail screen, read as one element by screen readers. */
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <AppText color="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
