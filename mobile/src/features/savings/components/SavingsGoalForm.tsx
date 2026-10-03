import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { appConfig } from '../../../core/config/appConfig';
import {
  AppText,
  Button,
  Card,
  ChoiceGroup,
  TextField,
} from '../../../shared/components';
import { useFormSubmission } from '../../../shared/hooks';
import { spacing } from '../../../shared/theme';
import type { Account } from '../../accounts/domain/types';
import type { NewSavingsGoal } from '../data/savingsGoalRepository';
import { InvalidSavingsGoalError } from '../domain/savingsGoalErrors';
import type { SavingsGoal } from '../domain/types';
import { SAVINGS_GOAL_NAME_MAX_LENGTH } from '../domain/validateSavingsGoal';
import {
  parseSavingsGoalForm,
  savingsGoalFieldOfError,
  type SavingsGoalFormErrors,
  type SavingsGoalFormValues,
} from './savingsGoalFormModel';
import {
  SAVINGS_GOAL_ERROR_MESSAGES,
  describeSavingsError,
} from './savingsMessages';

type SavingsGoalFormProps = {
  initialValues: SavingsGoalFormValues;
  /** Active accounts a new goal may use (credit cards excluded). */
  accounts: readonly Account[];
  /** Active goals: their accounts cannot get another one. */
  goals: readonly SavingsGoal[];
  /** Editing: the goal (fixed account) and its account. */
  editing?: { goal: SavingsGoal; account: Account | null };
  submitLabel: string;
  onSubmit: (input: NewSavingsGoal) => Promise<void>;
};

/**
 * Create/edit form of a savings goal: name, account (create only), target in the account's
 * currency and an optional target date.
 */
export function SavingsGoalForm({
  initialValues,
  accounts,
  goals,
  editing,
  submitLabel,
  onSubmit,
}: SavingsGoalFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<SavingsGoalFormErrors>({});
  const { submitting, submitError, submit } =
    useFormSubmission(describeSavingsError);

  const taken = new Set(goals.map(goal => goal.accountId));
  const account = editing
    ? editing.account
    : accounts.find(a => a.id === values.accountId) ?? null;
  const currency = account?.currency ?? appConfig.defaultCurrency;

  function update<K extends keyof SavingsGoalFormValues>(
    field: K,
    value: SavingsGoalFormValues[K],
  ) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  /** Rules broken in the meantime (e.g. a goal created elsewhere) map to fields. */
  function showOnFields(error: unknown): boolean {
    if (!(error instanceof InvalidSavingsGoalError)) {
      return false;
    }
    const fieldErrors: SavingsGoalFormErrors = {};
    for (const code of error.errors) {
      fieldErrors[savingsGoalFieldOfError(code)] ??=
        SAVINGS_GOAL_ERROR_MESSAGES[code];
    }
    setErrors(fieldErrors);
    return true;
  }

  function handleSubmit() {
    const result = parseSavingsGoalForm(values, currency, {
      account: account && {
        id: account.id,
        type: account.type,
        deletedAt: account.deletedAt,
      },
      existing: goals,
      currentId: editing?.goal.id,
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
          testID="savings-goal-name"
          label="Nombre de la meta"
          value={values.name}
          onChangeText={text => update('name', text)}
          placeholder="Laptop"
          autoCapitalize="sentences"
          maxLength={SAVINGS_GOAL_NAME_MAX_LENGTH}
          error={errors.name}
        />

        {editing ? (
          <TextField
            testID="savings-goal-account-locked"
            label="Cuenta"
            value={editing.account?.name ?? 'Cuenta'}
            onChangeText={() => {}}
            editable={false}
            hint="La cuenta no se puede cambiar. Para otra cuenta, archiva esta meta y crea una nueva."
          />
        ) : (
          <View style={styles.group}>
            <ChoiceGroup
              testID="savings-goal-account"
              label="Cuenta donde ahorras"
              options={accounts.map(a => ({
                value: a.id,
                label: `${a.name} (${a.currency})`,
                disabled: taken.has(a.id),
              }))}
              value={values.accountId}
              onChange={accountId => update('accountId', accountId)}
              error={errors.accountId}
              disabled={submitting}
            />
            <AppText variant="caption" color="textSecondary">
              Lo ahorrado es el saldo de esa cuenta. Las tarjetas de crédito no
              pueden tener metas
              {taken.size > 0
                ? ' y las cuentas que ya tienen una meta aparecen deshabilitadas.'
                : '.'}
            </AppText>
          </View>
        )}

        <TextField
          testID="savings-goal-target"
          label={`Monto objetivo (${currency})`}
          value={values.target}
          onChangeText={text => update('target', text)}
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={errors.target}
        />

        <TextField
          testID="savings-goal-date"
          label="Fecha objetivo (opcional, AAAA-MM-DD)"
          value={values.targetDate}
          onChangeText={text => update('targetDate', text)}
          placeholder="2026-12-15"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={errors.targetDate}
          hint="Solo informativa: déjala vacía si no tienes una fecha."
        />
      </Card>

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      <Button
        testID="savings-goal-submit"
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
