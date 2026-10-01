import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../../shared/icons';
import { layout, radius, useAppTheme } from '../../shared/theme';

const PRESSED_OPACITY = 0.85;

/** Center "main action" button of the tab bar. */
export function AddTabButton({ onPress }: BottomTabBarButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar movimiento"
      accessibilityHint="Abre el registro de un nuevo movimiento"
      onPress={onPress}
      style={styles.container}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.circle,
            { backgroundColor: theme.colors.primary },
            theme.shadows.md,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="add" size="lg" color="onPrimary" />
        </View>
      )}
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
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: PRESSED_OPACITY,
  },
});
