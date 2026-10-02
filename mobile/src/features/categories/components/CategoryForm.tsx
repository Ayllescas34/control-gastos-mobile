import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  ChoiceGroup,
  TextField,
} from '../../../shared/components';
import { useFormSubmission } from '../../../shared/hooks';
import { IconBadge, type IconTone } from '../../../shared/icons';
import { layout, radius, spacing, useAppTheme } from '../../../shared/theme';
import type { NewCategory } from '../data/categoryRepository';
import { InvalidCategoryError } from '../domain/categoryErrors';
import {
  CATEGORY_ICONS,
  type Category,
  type CategoryIcon,
} from '../domain/types';
import { CATEGORY_NAME_MAX_LENGTH } from '../domain/validateCategory';
import {
  categoryFieldOfError,
  parseCategoryForm,
  type CategoryFormErrors,
  type CategoryFormValues,
} from './categoryFormModel';
import {
  CATEGORY_ERROR_MESSAGES,
  describeCategoriesError,
} from './categoryMessages';
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_KIND_OPTIONS,
  CATEGORY_KIND_VISUALS,
  categoryIconName,
} from './categoryVisuals';

type CategoryFormProps = {
  initialValues: CategoryFormValues;
  /** Active categories, for the duplicate-name rule. */
  existing: readonly Category[];
  /** Editing: the category itself (may keep its name) and a fixed kind. */
  editing?: Category;
  submitLabel: string;
  onSubmit: (input: NewCategory) => Promise<void>;
};

/** Create/edit form for a category: name, kind (create only) and icon. */
export function CategoryForm({
  initialValues,
  existing,
  editing,
  submitLabel,
  onSubmit,
}: CategoryFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<CategoryFormErrors>({});
  const { submitting, submitError, submit } = useFormSubmission(
    describeCategoriesError,
  );
  const tone = values.kind
    ? CATEGORY_KIND_VISUALS[values.kind].tone
    : 'neutral';

  function update<K extends keyof CategoryFormValues>(
    field: K,
    value: CategoryFormValues[K],
  ) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  /** Rules broken in the meantime (e.g. a duplicate created elsewhere) map to fields. */
  function showOnFields(error: unknown): boolean {
    if (!(error instanceof InvalidCategoryError)) {
      return false;
    }
    const fieldErrors: CategoryFormErrors = {};
    for (const code of error.errors) {
      fieldErrors[categoryFieldOfError(code)] ??= CATEGORY_ERROR_MESSAGES[code];
    }
    setErrors(fieldErrors);
    return true;
  }

  function handleSubmit() {
    const result = parseCategoryForm(values, {
      existing,
      currentId: editing?.id,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    submit(() => onSubmit(result.input), showOnFields);
  }

  return (
    <View style={styles.form}>
      <Card style={styles.fields}>
        <TextField
          testID="category-name"
          label="Nombre"
          value={values.name}
          onChangeText={text => update('name', text)}
          placeholder="Ej. Mascotas"
          autoCapitalize="sentences"
          maxLength={CATEGORY_NAME_MAX_LENGTH}
          error={errors.name}
        />
        {editing ? (
          <TextField
            testID="category-kind-locked"
            label="Tipo"
            value={CATEGORY_KIND_VISUALS[editing.kind].label}
            onChangeText={() => {}}
            editable={false}
            hint="El tipo no se puede cambiar: sus movimientos dependen de él."
          />
        ) : (
          <ChoiceGroup
            testID="category-kind"
            label="Tipo"
            options={CATEGORY_KIND_OPTIONS}
            value={values.kind}
            onChange={kind => update('kind', kind)}
            error={errors.kind}
            disabled={submitting}
          />
        )}
        <IconPicker
          value={values.icon}
          tone={tone}
          onChange={icon => update('icon', icon)}
          error={errors.icon}
          disabled={submitting}
        />
      </Card>

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      <Button
        testID="category-submit"
        title={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
      />
    </View>
  );
}

type IconPickerProps = {
  value: CategoryIcon | null;
  tone: IconTone;
  onChange: (icon: CategoryIcon) => void;
  error?: string;
  disabled: boolean;
};

/** Single choice among the category icons, announced by their Spanish names. */
function IconPicker({
  value,
  tone,
  onChange,
  error,
  disabled,
}: IconPickerProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.pickerGroup}>
      <AppText variant="label" color="textSecondary">
        Icono
      </AppText>
      <View
        style={styles.icons}
        accessibilityRole="radiogroup"
        accessibilityLabel="Icono"
      >
        {CATEGORY_ICONS.map(icon => {
          const selected = icon === value;
          return (
            <Pressable
              key={icon}
              testID={`category-icon-${icon}`}
              accessibilityRole="radio"
              accessibilityLabel={CATEGORY_ICON_LABELS[icon]}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={disabled ? undefined : () => onChange(icon)}
              style={[
                styles.iconOption,
                selected && { borderColor: theme.colors.primary },
              ]}
            >
              <IconBadge
                name={categoryIconName(icon)}
                variant={selected ? tone : 'neutral'}
              />
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
  form: {
    gap: spacing.lg,
  },
  fields: {
    gap: spacing.lg,
  },
  pickerGroup: {
    gap: spacing.xs,
  },
  icons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconOption: {
    alignItems: 'center',
    justifyContent: 'center',
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
