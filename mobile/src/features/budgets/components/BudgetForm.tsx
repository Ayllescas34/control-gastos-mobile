import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  ChoiceGroup,
  TextField,
} from '../../../shared/components';
import { useFormSubmission } from '../../../shared/hooks';
import type { CurrencyCode } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import type { Category } from '../../categories/domain/types';
import type { NewBudget } from '../data/budgetRepository';
import { InvalidBudgetError } from '../domain/budgetErrors';
import type { Budget } from '../domain/types';
import {
  budgetFieldOfError,
  parseBudgetForm,
  type BudgetFormErrors,
  type BudgetFormValues,
} from './budgetFormModel';
import { BUDGET_ERROR_MESSAGES, describeBudgetsError } from './budgetMessages';

type BudgetFormProps = {
  initialValues: BudgetFormValues;
  /** Active expense categories a new budget may use. */
  categories: readonly Category[];
  /** Active budgets: their categories cannot get another one in the same currency. */
  budgets: readonly Budget[];
  /** Editing: the budget (fixed category and currency) and its category. */
  editing?: { budget: Budget; category: Category | null };
  currency: CurrencyCode;
  submitLabel: string;
  onSubmit: (input: NewBudget) => Promise<void>;
};

/** Create/edit form of a budget: category (create only), monthly limit, fixed currency. */
export function BudgetForm({
  initialValues,
  categories,
  budgets,
  editing,
  currency,
  submitLabel,
  onSubmit,
}: BudgetFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<BudgetFormErrors>({});
  const { submitting, submitError, submit } =
    useFormSubmission(describeBudgetsError);

  const taken = new Set(
    budgets
      .filter(budget => budget.currency === currency)
      .map(budget => budget.categoryId),
  );
  const category = editing
    ? editing.category
    : categories.find(c => c.id === values.categoryId) ?? null;

  function update<K extends keyof BudgetFormValues>(
    field: K,
    value: BudgetFormValues[K],
  ) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  /** Rules broken in the meantime (e.g. a budget created elsewhere) map to fields. */
  function showOnFields(error: unknown): boolean {
    if (!(error instanceof InvalidBudgetError)) {
      return false;
    }
    const fieldErrors: BudgetFormErrors = {};
    for (const code of error.errors) {
      fieldErrors[budgetFieldOfError(code)] ??= BUDGET_ERROR_MESSAGES[code];
    }
    setErrors(fieldErrors);
    return true;
  }

  function handleSubmit() {
    const result = parseBudgetForm(values, currency, {
      category: category && {
        id: category.id,
        kind: category.kind,
        deletedAt: category.deletedAt,
      },
      existing: budgets,
      currentId: editing?.budget.id,
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
        {editing ? (
          <TextField
            testID="budget-category-locked"
            label="Categoría"
            value={
              editing.category
                ? `${editing.category.name}${
                    editing.category.deletedAt ? ' (archivada)' : ''
                  }`
                : 'Categoría'
            }
            onChangeText={() => {}}
            editable={false}
            hint="La categoría no se puede cambiar. Para otra categoría, archiva este presupuesto y crea uno nuevo."
          />
        ) : (
          <View style={styles.group}>
            <ChoiceGroup
              testID="budget-category"
              label="Categoría"
              options={categories.map(c => ({
                value: c.id,
                label: c.name,
                icon: c.icon,
                disabled: taken.has(c.id),
              }))}
              value={values.categoryId}
              onChange={categoryId => update('categoryId', categoryId)}
              error={errors.categoryId}
              disabled={submitting}
            />
            {taken.size > 0 && (
              <AppText variant="caption" color="textSecondary">
                Las categorías que ya tienen presupuesto aparecen
                deshabilitadas.
              </AppText>
            )}
          </View>
        )}

        <TextField
          testID="budget-amount"
          label={`Presupuesto mensual (${currency})`}
          value={values.amount}
          onChangeText={text => update('amount', text)}
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={errors.amount}
        />

        <TextField
          testID="budget-currency"
          label="Moneda"
          value={currency}
          onChangeText={() => {}}
          editable={false}
          hint={
            editing
              ? 'La moneda de un presupuesto no se puede cambiar.'
              : 'Por ahora los presupuestos usan quetzales (GTQ).'
          }
        />
      </Card>

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      <Button
        testID="budget-submit"
        title={submitLabel}
        onPress={handleSubmit}
        loading={submitting}
      />
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
  group: {
    gap: spacing.xs,
  },
});
