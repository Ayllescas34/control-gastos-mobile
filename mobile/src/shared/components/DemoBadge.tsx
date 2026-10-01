import { StyleSheet, View } from 'react-native';
import { Icon } from '../icons';
import { radius, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

/** Marks screens that show sample data instead of real user data. */
export function DemoBadge() {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.colors.demoBackground }]}
    >
      <Icon name="info" size="sm" color="demoText" />
      <AppText variant="caption" color="demoText">
        Datos de demostración — no son movimientos reales
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
