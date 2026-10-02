import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme';

type LoadingStateProps = {
  /** Announced by screen readers while the content loads. */
  accessibilityLabel?: string;
};

/** Full-area spinner shown while a screen's data loads. */
export function LoadingState({
  accessibilityLabel = 'Cargando',
}: LoadingStateProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator
        color={theme.colors.primary}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
