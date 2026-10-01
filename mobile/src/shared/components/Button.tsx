import { Pressable, StyleSheet } from 'react-native';
import { radius, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

export function Button({ title, onPress, variant = 'primary' }: ButtonProps) {
  const theme = useAppTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? theme.colors.primary : 'transparent',
          borderColor: theme.colors.primary,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText
        variant="bodyStrong"
        style={{ color: isPrimary ? theme.colors.onPrimary : theme.colors.primary }}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
