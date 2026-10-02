import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../icons';
import { layout, radius, spacing, useAppTheme, withAlpha } from '../theme';
import { AppText } from './AppText';

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type ChoiceGroupProps<T extends string> = {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Validation message for the group. */
  error?: string;
  disabled?: boolean;
  /** Each option gets `${testID}-${value}`. */
  testID?: string;
};

const SELECTED_TINT = 0.12;

/**
 * Single choice among a closed set of values (a radio group drawn as chips), so typed
 * values such as an account type are never entered as free text.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
  testID,
}: ChoiceGroupProps<T>) {
  const theme = useAppTheme();

  return (
    <View style={styles.group}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <View
        style={styles.options}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map(option => {
          const selected = option.value === value;
          const foreground = selected ? 'primary' : 'textPrimary';
          return (
            <Pressable
              key={option.value}
              testID={testID ? `${testID}-${option.value}` : undefined}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={disabled ? undefined : () => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected
                    ? withAlpha(theme.colors.primary, SELECTED_TINT)
                    : theme.colors.surfaceMuted,
                  borderColor: selected ? theme.colors.primary : 'transparent',
                  opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              {option.icon && (
                <Icon name={option.icon} size="sm" color={foreground} />
              )}
              <AppText variant="label" color={foreground}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error !== undefined && (
        <AppText
          variant="caption"
          color="error"
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
