import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconBadge, type IconName } from '../icons';
import { layout, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

type EmptyStateProps = {
  /** Optional illustration; decorative, the title carries the meaning. */
  icon?: IconName;
  title: string;
  message: string;
  children?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  message,
  children,
}: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {icon && <IconBadge name={icon} variant="primary" size="lg" />}
      <AppText variant="title" style={styles.centered}>
        {title}
      </AppText>
      <AppText color="textSecondary" style={styles.centered}>
        {message}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: layout.screenPadding,
  },
  centered: {
    textAlign: 'center',
  },
});
