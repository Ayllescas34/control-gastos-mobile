import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { Icon, IconBadge } from '../../../shared/icons';
import { layout, radius, spacing, useAppTheme } from '../../../shared/theme';
import { PIN_LENGTH } from '../domain/pinRules';

type PinPadProps = {
  title: string;
  message?: string;
  /** Shown under the dots, announced by screen readers. */
  error?: string | null;
  /** While checking or waiting: keys do nothing. */
  disabled?: boolean;
  /** Called with the six digits; the pad clears itself afterwards. */
  onComplete: (pin: string) => void;
  /** Extra actions under the keypad ("Olvidé mi PIN", "Cancelar"). */
  children?: ReactNode;
  testID?: string;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];
/** Keys a bit larger than the minimum touch target. */
const KEY_SIZE = layout.minTouchTarget + spacing.xl;

/**
 * Six-digit PIN entry with its own keypad (the system keyboard could keep or suggest the
 * digits). The digits stay in memory only until they are handed to onComplete.
 */
export function PinPad({
  title,
  message,
  error,
  disabled = false,
  onComplete,
  children,
  testID = 'pin-pad',
}: PinPadProps) {
  const theme = useAppTheme();
  const [digits, setDigits] = useState('');

  function press(key: string) {
    if (disabled) {
      return;
    }
    if (key === 'delete') {
      setDigits(current => current.slice(0, -1));
      return;
    }
    const next = `${digits}${key}`;
    if (next.length < PIN_LENGTH) {
      setDigits(next);
      return;
    }
    setDigits('');
    onComplete(next);
  }

  return (
    <View testID={testID} style={styles.container}>
      <IconBadge name="lock" variant="primary" size="lg" />
      <AppText variant="title" accessibilityRole="header" style={styles.center}>
        {title}
      </AppText>
      {message !== undefined && (
        <AppText color="textSecondary" style={styles.center}>
          {message}
        </AppText>
      )}

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${digits.length} de ${PIN_LENGTH} dígitos`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => {
          const filled = index < digits.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                { borderColor: theme.colors.primary },
                filled && { backgroundColor: theme.colors.primary },
              ]}
            />
          );
        })}
      </View>

      <AppText
        color="error"
        accessibilityLiveRegion="polite"
        style={[styles.center, styles.error]}
      >
        {error ?? ' '}
      </AppText>

      <View style={styles.keys}>
        {KEYS.map((key, index) =>
          key === '' ? (
            <View key={`blank-${index}`} style={styles.key} />
          ) : (
            <Pressable
              key={key}
              testID={`${testID}-key-${key}`}
              accessibilityRole="button"
              accessibilityLabel={key === 'delete' ? 'Borrar' : key}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed
                    ? theme.colors.border
                    : key === 'delete'
                    ? 'transparent'
                    : theme.colors.surfaceMuted,
                },
                disabled && styles.disabled,
              ]}
            >
              {key === 'delete' ? (
                <Icon name="back" size="lg" color="textPrimary" />
              ) : (
                <AppText variant="title">{key}</AppText>
              )}
            </Pressable>
          ),
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
  },
  center: {
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  dot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  error: {
    minHeight: spacing.xl,
  },
  keys: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    width: KEY_SIZE * 3 + spacing.lg * 2,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
