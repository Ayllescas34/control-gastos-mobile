import { StyleSheet, View } from 'react-native';
import { radius, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

/** Marks screens that show sample data instead of real user data. */
export function DemoBadge() {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.colors.demoBackground }]}
    >
      <AppText variant="caption" color="demoText">
        Datos de demostración — no son movimientos reales
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
