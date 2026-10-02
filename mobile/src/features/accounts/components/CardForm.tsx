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
import { spacing } from '../../../shared/theme';
import type { NewCard } from '../data/cardRepository';
import { InvalidCardError } from '../domain/accountErrors';
import type { Account } from '../domain/types';
import { CARD_ALIAS_MAX_LENGTH } from '../domain/validateCard';
import { CARD_ERROR_MESSAGES, describeAccountsError } from './accountMessages';
import { ACCOUNT_TYPE_VISUALS, CARD_NETWORK_OPTIONS } from './accountVisuals';
import {
  cardFieldOfError,
  parseCardForm,
  type CardFormErrors,
  type CardFormValues,
} from './cardFormModel';

type CardFormProps = {
  initialValues: CardFormValues;
  /** Accounts the card can belong to. Ignored when the account is locked. */
  accounts: readonly Account[];
  /** Editing: the account is shown but cannot change (transactions reference it). */
  lockedAccount?: Account;
  submitLabel: string;
  onSubmit: (input: NewCard) => Promise<void>;
};

/**
 * Create/edit form for a card. Asks only for safe identification data.
 * SECURITY: never asks for (or accepts) the full card number, CVV or PIN.
 */
export function CardForm({
  initialValues,
  accounts,
  lockedAccount,
  submitLabel,
  onSubmit,
}: CardFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<CardFormErrors>({});
  const { submitting, submitError, submit } = useFormSubmission(
    describeAccountsError,
  );

  function update<K extends keyof CardFormValues>(
    field: K,
    value: CardFormValues[K],
  ) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  /** Domain errors raised by the repository (e.g. the account was archived meanwhile). */
  function showOnFields(error: unknown): boolean {
    if (!(error instanceof InvalidCardError)) {
      return false;
    }
    const fieldErrors: CardFormErrors = {};
    for (const code of error.errors) {
      fieldErrors[cardFieldOfError(code)] ??= CARD_ERROR_MESSAGES[code];
    }
    setErrors(fieldErrors);
    return true;
  }

  function handleSubmit() {
    const result = parseCardForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    submit(() => onSubmit(result.input), showOnFields);
  }

  const accountOptions = accounts.map(account => ({
    value: account.id,
    label: account.name,
    icon: ACCOUNT_TYPE_VISUALS[account.type].icon,
  }));

  return (
    <View style={styles.form}>
      <Card style={styles.fields}>
        <TextField
          testID="card-alias"
          label="Nombre de la tarjeta"
          value={values.alias}
          onChangeText={text => update('alias', text)}
          placeholder="Ej. Visa personal"
          autoCapitalize="sentences"
          maxLength={CARD_ALIAS_MAX_LENGTH}
          error={errors.alias}
        />
        <TextField
          testID="card-last4"
          label="Últimos 4 dígitos"
          value={values.last4}
          // Digits only, at most four: a full card number cannot even be typed.
          onChangeText={text =>
            update('last4', text.replace(/\D/g, '').slice(0, 4))
          }
          placeholder="1234"
          keyboardType="number-pad"
          maxLength={4}
          error={errors.last4}
          hint="Nunca escribas el número completo, el CVV ni el PIN."
        />
        <ChoiceGroup
          testID="card-network"
          label="Red"
          options={CARD_NETWORK_OPTIONS}
          value={values.network}
          onChange={network => update('network', network)}
          error={errors.network}
          disabled={submitting}
        />
        {lockedAccount ? (
          <TextField
            testID="card-account-locked"
            label="Cuenta"
            value={lockedAccount.name}
            onChangeText={() => {}}
            editable={false}
            hint="La cuenta de una tarjeta no se puede cambiar."
          />
        ) : (
          <ChoiceGroup
            testID="card-account"
            label="Cuenta"
            options={accountOptions}
            value={values.accountId}
            onChange={accountId => update('accountId', accountId)}
            error={errors.accountId}
            disabled={submitting}
          />
        )}
      </Card>

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      <Button
        testID="card-submit"
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
