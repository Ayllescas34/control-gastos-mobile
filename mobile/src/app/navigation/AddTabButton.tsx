import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../shared/components';
import { radius, useAppTheme } from '../../shared/theme';

/** Center "main action" button of the tab bar. */
export function AddTabButton({ onPress }: BottomTabBarButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar movimiento"
      onPress={onPress}
      style={styles.container}
    >
      <View style={[styles.circle, { backgroundColor: theme.colors.primary }]}>
        <AppText variant="title" style={{ color: theme.colors.onPrimary }}>
          +
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
