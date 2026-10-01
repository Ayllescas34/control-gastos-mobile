import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { layout, radius, spacing, useAppTheme } from '../theme';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Surface for grouped content: soft shadow in light mode, surface contrast in dark mode. */
export function Card({ children, style }: CardProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        theme.shadows.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: layout.cardPadding,
    gap: spacing.xs,
  },
});
