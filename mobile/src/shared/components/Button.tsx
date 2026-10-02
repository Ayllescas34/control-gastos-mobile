import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { layout, radius, spacing, useAppTheme, type AppTheme } from '../theme';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** `danger` is for destructive or irreversible-looking actions such as archiving. */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shows a spinner and blocks presses, e.g. while saving. */
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const DISABLED_OPACITY = 0.5;
const PRESSED_OPACITY = 0.7;

function variantColors(variant: ButtonVariant, theme: AppTheme) {
  switch (variant) {
    case 'primary':
      return {
        background: theme.colors.primary,
        border: theme.colors.primary,
        text: theme.colors.onPrimary,
      };
    case 'secondary':
      return {
        background: 'transparent',
        border: theme.colors.primary,
        text: theme.colors.primary,
      };
    case 'danger':
      return {
        background: 'transparent',
        border: theme.colors.error,
        text: theme.colors.error,
      };
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useAppTheme();
  const colors = variantColors(variant, theme);
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: disabled ? DISABLED_OPACITY : pressed ? PRESSED_OPACITY : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <AppText variant="bodyStrong" style={{ color: colors.text }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
