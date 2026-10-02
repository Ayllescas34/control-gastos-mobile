import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { layout, useAppTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  /** Set to false when the screen renders its own virtualized list. */
  scrollable?: boolean;
};

export function Screen({ children, scrollable = true }: ScreenProps) {
  const theme = useAppTheme();
  const background = { backgroundColor: theme.colors.background };

  if (!scrollable) {
    return <View style={[styles.fill, background]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.fill, background]}
      contentContainerStyle={styles.content}
      // A tap on a button while the keyboard is open triggers it on the first tap.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    padding: layout.screenPadding,
    gap: layout.sectionGap,
  },
});
