import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  ChoiceGroup,
  TextField,
} from '../../../shared/components';
import type { CurrencyCode } from '../../../shared/lib/money';
import { useFormSubmission } from '../../../shared/hooks';
import { spacing } from '../../../shared/theme';
import type { NewAccount } from '../data/accountRepository';
import { ACCOUNT_NAME_MAX_LENGTH } from '../domain/validateAccount';
import {
  parseAccountForm,
  type AccountFormErrors,
  type AccountFormValues,
} from './accountFormModel';
import { describeAccountsError } from './accountMessages';
import { ACCOUNT_TYPE_OPTIONS } from './accountVisuals';

type AccountFormProps = {
  initialValues: AccountFormValues;
  currency: CurrencyCode;
  /** Explains why the currency is fixed (new vs existing account). */
  currencyHint: string;
  submitLabel: string;
  /** Persists the validated input. Throwing keeps the form open with an error. */
  onSubmit: (input: NewAccount) => Promise<void>;
};

/** Create/edit form for an account. Validation comes from the domain via parseAccountForm. */
export function AccountForm({
  initialValues,
  currency,
  currencyHint,
  submitLabel,
  onSubmit,
}: AccountFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const { submitting, submitError, submit } = useFormSubmission(
    describeAccountsError,
  );

  function update<K extends keyof AccountFormValues>(
    field: K,
    value: AccountFormValues[K],
  ) {
    setValues(current => ({ ...current, [field]: value }));
    // The message refers to the old value; it comes back on the next submit if still wrong.
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  function handleSubmit() {
    const result = parseAccountForm(values, currency);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    submit(() => onSubmit(result.input));
  }

  const balanceHint =
    values.type === 'credit_card'
      ? 'Si la tarjeta tiene deuda, escribe un número negativo (por ejemplo -1500).'
      : 'Opcional. Cuánto dinero tiene la cuenta hoy.';

  return (
    <View style={styles.form}>
      <Card style={styles.fields}>
        <TextField
          testID="account-name"
          label="Nombre"
          value={values.name}
          onChangeText={text => update('name', text)}
          placeholder="Ej. Cuenta monetaria"
          autoCapitalize="sentences"
          maxLength={ACCOUNT_NAME_MAX_LENGTH}
          error={errors.name}
        />
        <ChoiceGroup
          testID="account-type"
          label="Tipo de cuenta"
          options={ACCOUNT_TYPE_OPTIONS}
          value={values.type}
          onChange={type => update('type', type)}
          error={errors.type}
          disabled={submitting}
        />
        <TextField
          testID="account-currency"
          label="Moneda"
          value={currency}
          onChangeText={() => {}}
          editable={false}
          hint={currencyHint}
        />
        <TextField
          testID="account-initial-balance"
          label={`Saldo inicial (${currency})`}
          value={values.initialBalance}
          onChangeText={text => update('initialBalance', text)}
          placeholder="0.00"
          keyboardType="numbers-and-punctuation"
          error={errors.initialBalance}
          hint={balanceHint}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </Card>

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      <Button
        testID="account-submit"
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
});
