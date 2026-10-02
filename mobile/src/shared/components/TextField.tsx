import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { layout, radius, spacing, useAppTheme } from '../theme';
import { AppText } from './AppText';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Validation message; also marks the field as invalid. */
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  editable?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  testID?: string;
};

/** Labelled text input with inline validation, styled with Design System tokens. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  keyboardType,
  autoCapitalize,
  maxLength,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  testID,
}: TextFieldProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.error
    : focused
    ? theme.colors.primary
    : theme.colors.border;
  const helper = error ?? hint;

  return (
    <View style={styles.field}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        accessibilityHint={helper}
        accessibilityState={{ disabled: !editable }}
        style={[
          theme.typography.body,
          styles.input,
          {
            color: theme.colors.textPrimary,
            backgroundColor: editable
              ? theme.colors.surface
              : theme.colors.surfaceMuted,
            borderColor,
          },
        ]}
      />
      {helper !== undefined && (
        <AppText
          variant="caption"
          color={error ? 'error' : 'textSecondary'}
          // Announces a new validation message without moving focus.
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        >
          {helper}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  input: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
