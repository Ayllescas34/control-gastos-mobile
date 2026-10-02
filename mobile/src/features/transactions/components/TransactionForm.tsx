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
import type { Account, Card as PaymentCard } from '../../accounts';
import { ACCOUNT_TYPE_VISUALS } from '../../accounts/components/accountVisuals';
import type { Category } from '../../categories';
import {
  InvalidTransactionError,
  type NewTransaction,
} from '../data/transactionRepository';
import type { Transaction, TransactionType } from '../domain/types';
import type { ReferenceLookup } from './referenceLookup';
import {
  parseTransactionForm,
  transactionFieldOfError,
  type DateChoice,
  type TransactionFormErrors,
  type TransactionFormValues,
} from './transactionFormModel';
import {
  describeTransactionsError,
  TRANSACTION_ERROR_MESSAGES,
} from './transactionMessages';
import { TRANSACTION_TYPE_VISUALS } from './transactionTypeVisuals';

/** The error a value change clears (text fields without validation clear none). */
const ERROR_FIELD_OF_VALUE: Partial<
  Record<keyof TransactionFormValues, keyof TransactionFormErrors>
> = {
  type: 'type',
  amount: 'amount',
  accountId: 'accountId',
  toAccountId: 'toAccountId',
  categoryId: 'categoryId',
  cardId: 'cardId',
  dateChoice: 'date',
  otherDate: 'date',
};

/** ChoiceGroup values are strings, so "none" stands for a null category or card. */
const NONE = 'none';

const TYPE_OPTIONS = (['expense', 'income', 'transfer'] as const).map(type => ({
  value: type,
  label: TRANSACTION_TYPE_VISUALS[type].label,
  icon: TRANSACTION_TYPE_VISUALS[type].icon,
}));

const DATE_OPTIONS: readonly { value: DateChoice; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'other', label: 'Otra fecha' },
];

/** Active entities, plus the one the edited movement already uses (even if archived). */
function withCurrent<T extends { id: string }>(
  active: T[],
  current: T | undefined,
): T[] {
  return current && !active.some(item => item.id === current.id)
    ? [...active, current]
    : active;
}

const accountOption = (account: Account) => ({
  value: account.id,
  label: account.name,
  icon: ACCOUNT_TYPE_VISUALS[account.type].icon,
});

type TransactionFormProps = {
  initialValues: TransactionFormValues;
  references: ReferenceLookup;
  /** The movement being edited, if any. */
  previous: Transaction | null;
  submitLabel: string;
  onSubmit: (input: NewTransaction) => Promise<void>;
};

/** Create/edit form: type first, then only the fields that type uses. */
export function TransactionForm({
  initialValues,
  references,
  previous,
  submitLabel,
  onSubmit,
}: TransactionFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const { submitting, submitError, submit } = useFormSubmission(
    describeTransactionsError,
  );

  const type = values.type;
  const account = references.account(values.accountId);
  const accounts = withCurrent(
    references.activeAccounts,
    references.account(previous?.accountId ?? null),
  );
  const toAccounts = withCurrent(
    references.activeAccounts,
    references.account(previous?.toAccountId ?? null),
  ).filter(candidate => candidate.id !== values.accountId);
  const toAccount = references.account(values.toAccountId);

  function change(next: Partial<TransactionFormValues>) {
    setValues(current => {
      const merged = { ...current, ...next };
      // Drop choices the new type or account can no longer have.
      if (merged.type !== 'expense') {
        merged.cardId = null;
      } else if (
        merged.cardId !== null &&
        references.card(merged.cardId)?.accountId !== merged.accountId
      ) {
        merged.cardId = null;
      }
      if (
        merged.type !== 'transfer' ||
        merged.toAccountId === merged.accountId
      ) {
        merged.toAccountId = null;
      }
      if (
        merged.categoryId !== null &&
        (merged.type === 'transfer' ||
          references.category(merged.categoryId)?.kind !== merged.type)
      ) {
        merged.categoryId = null;
      }
      return merged;
    });
    // A message refers to the old value; it comes back on the next submit if still wrong.
    setErrors(current => {
      const cleared = { ...current };
      for (const key of Object.keys(next) as (keyof TransactionFormValues)[]) {
        delete cleared[ERROR_FIELD_OF_VALUE[key] ?? 'type'];
      }
      return cleared;
    });
  }

  /** Rules checked against stored data (card of the account, currencies…) map to fields. */
  function showOnFields(error: unknown): boolean {
    if (!(error instanceof InvalidTransactionError)) {
      return false;
    }
    const fieldErrors: TransactionFormErrors = {};
    for (const code of error.errors) {
      fieldErrors[transactionFieldOfError(code)] ??=
        TRANSACTION_ERROR_MESSAGES[code];
    }
    setErrors(fieldErrors);
    return true;
  }

  function handleSubmit() {
    const result = parseTransactionForm(values, references, previous);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    submit(() => onSubmit(result.input), showOnFields);
  }

  const categories: Category[] =
    type === 'expense' || type === 'income'
      ? withCurrent(
          references.activeCategoriesOf(type),
          references.category(previous?.categoryId ?? null),
        ).filter(category => category.kind === type)
      : [];
  const cards: PaymentCard[] = withCurrent(
    references.activeCardsOf(values.accountId),
    references.card(previous?.cardId ?? null),
  ).filter(card => card.accountId === values.accountId);

  return (
    <View style={styles.form}>
      <Card style={styles.fields}>
        <ChoiceGroup
          testID="transaction-type"
          label="Tipo de movimiento"
          options={TYPE_OPTIONS}
          value={type}
          onChange={next => change({ type: next as TransactionType })}
          error={errors.type}
          disabled={submitting}
        />
        {type === null && (
          <AppText color="textSecondary">
            Elige si registras un gasto, un ingreso o una transferencia entre
            tus cuentas.
          </AppText>
        )}
      </Card>

      {type !== null && (
        <Card style={styles.fields}>
          <TextField
            testID="transaction-amount"
            label={`Monto (${account?.currency ?? 'GTQ'})`}
            value={values.amount}
            onChangeText={amount => change({ amount })}
            placeholder="0.00"
            keyboardType="decimal-pad"
            error={errors.amount}
          />

          <ChoiceGroup
            testID="transaction-account"
            label={type === 'transfer' ? 'Cuenta de origen' : 'Cuenta'}
            options={accounts.map(accountOption)}
            value={values.accountId}
            onChange={accountId => change({ accountId })}
            error={errors.accountId}
            disabled={submitting}
          />

          {type === 'transfer' && (
            <>
              <ChoiceGroup
                testID="transaction-to-account"
                label="Cuenta de destino"
                options={toAccounts.map(accountOption)}
                value={values.toAccountId}
                onChange={toAccountId => change({ toAccountId })}
                error={errors.toAccountId}
                disabled={submitting}
              />
              {toAccount?.type === 'credit_card' && (
                <AppText variant="caption" color="textSecondary">
                  Pago de tarjeta de crédito: se registra como transferencia, no
                  como un gasto, porque cada compra ya es un gasto.
                </AppText>
              )}
            </>
          )}

          {type !== 'transfer' && (
            <ChoiceGroup
              testID="transaction-category"
              label="Categoría"
              options={[
                { value: NONE, label: 'Sin categoría' },
                ...categories.map(category => ({
                  value: category.id,
                  label: category.name,
                  icon: category.icon,
                })),
              ]}
              value={values.categoryId ?? NONE}
              onChange={categoryId =>
                change({ categoryId: categoryId === NONE ? null : categoryId })
              }
              error={errors.categoryId}
              disabled={submitting}
            />
          )}

          {type === 'expense' && account && (
            <ChoiceGroup
              testID="transaction-card"
              label="Tarjeta (opcional)"
              options={[
                { value: NONE, label: 'Sin tarjeta' },
                ...cards.map(card => ({
                  value: card.id,
                  label: `${card.alias} •••• ${card.last4}`,
                  icon: 'creditCard' as const,
                })),
              ]}
              value={values.cardId ?? NONE}
              onChange={cardId =>
                change({ cardId: cardId === NONE ? null : cardId })
              }
              error={errors.cardId}
              disabled={submitting}
            />
          )}

          <ChoiceGroup
            testID="transaction-date"
            label="Fecha"
            options={DATE_OPTIONS}
            value={values.dateChoice}
            onChange={dateChoice => change({ dateChoice })}
            error={values.dateChoice === 'other' ? undefined : errors.date}
            disabled={submitting}
          />
          {values.dateChoice === 'other' && (
            <TextField
              testID="transaction-other-date"
              label="Fecha (AAAA-MM-DD)"
              value={values.otherDate}
              onChangeText={otherDate => change({ otherDate })}
              placeholder="2026-09-28"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={errors.date}
            />
          )}

          {type !== 'transfer' && (
            <TextField
              testID="transaction-payee"
              label={type === 'expense' ? 'Comercio' : 'Origen'}
              value={values.payee}
              onChangeText={payee => change({ payee })}
              placeholder={
                type === 'expense' ? 'Ej. Supermercado' : 'Ej. Empresa'
              }
              autoCapitalize="sentences"
              maxLength={80}
            />
          )}
          <TextField
            testID="transaction-description"
            label="Descripción"
            value={values.description}
            onChangeText={description => change({ description })}
            autoCapitalize="sentences"
            maxLength={120}
          />
          <TextField
            testID="transaction-note"
            label="Nota"
            value={values.note}
            onChangeText={note => change({ note })}
            autoCapitalize="sentences"
            maxLength={250}
          />
        </Card>
      )}

      {submitError !== null && (
        <AppText color="error" accessibilityLiveRegion="polite">
          {submitError}
        </AppText>
      )}

      {type !== null && (
        <Button
          testID="transaction-submit"
          title={submitLabel}
          onPress={handleSubmit}
          loading={submitting}
        />
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
});
