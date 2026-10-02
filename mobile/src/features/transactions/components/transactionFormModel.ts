import type { EntityId, LocalDate } from '../../../shared/domain';
import {
  isValidLocalDate,
  localDateDaysBefore,
  occurredAtFor,
  todayLocalDate,
} from '../../../shared/lib/dates';
import { formatMoneyInput, parseMoney } from '../../../shared/lib/money';
import type { NewTransaction } from '../data/transactionRepository';
import type { Transaction, TransactionType } from '../domain/types';
import {
  validateTransactionFields,
  type TransactionValidationError,
} from '../domain/validateTransaction';
import type { ReferenceLookup } from './referenceLookup';
import { TRANSACTION_ERROR_MESSAGES } from './transactionMessages';

export type DateChoice = 'today' | 'yesterday' | 'other';

/** What the user typed. Money stays text until it is parsed into minor units. */
export type TransactionFormValues = {
  type: TransactionType | null;
  amount: string;
  accountId: EntityId | null;
  toAccountId: EntityId | null;
  categoryId: EntityId | null;
  cardId: EntityId | null;
  dateChoice: DateChoice;
  /** YYYY-MM-DD, used when dateChoice is "other". */
  otherDate: string;
  payee: string;
  description: string;
  note: string;
};

export type TransactionFormField =
  | 'type'
  | 'amount'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'cardId'
  | 'date';
export type TransactionFormErrors = Partial<
  Record<TransactionFormField, string>
>;

export type TransactionFormResult =
  | { ok: true; input: NewTransaction }
  | { ok: false; errors: TransactionFormErrors };

const FIELD_OF_ERROR: Record<TransactionValidationError, TransactionFormField> =
  {
    amount_not_integer: 'amount',
    amount_not_positive: 'amount',
    to_account_not_allowed: 'toAccountId',
    to_account_required: 'toAccountId',
    to_account_same_as_account: 'toAccountId',
    category_not_allowed_for_transfer: 'categoryId',
    card_not_allowed_for_transfer: 'cardId',
    card_not_in_account: 'cardId',
    local_date_invalid: 'date',
    account_not_found: 'accountId',
    to_account_not_found: 'toAccountId',
    currency_mismatch: 'toAccountId',
    category_not_found: 'categoryId',
    category_kind_mismatch: 'categoryId',
  };

export function transactionFieldOfError(
  code: TransactionValidationError,
): TransactionFormField {
  return FIELD_OF_ERROR[code];
}

const MONEY_ERROR_MESSAGES = {
  empty: 'Escribe el monto.',
  invalid: 'Escribe un monto como 450 o 1,250.75.',
  too_many_decimals: 'Usa como máximo 2 decimales.',
  too_large: 'El monto es demasiado grande.',
} as const;

export function emptyTransactionForm(
  type: TransactionType | null,
  accountId: EntityId | null,
): TransactionFormValues {
  return {
    type,
    amount: '',
    accountId,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    dateChoice: 'today',
    otherDate: '',
    payee: '',
    description: '',
    note: '',
  };
}

export function transactionToFormValues(
  transaction: Transaction,
  now: Date = new Date(),
): TransactionFormValues {
  const today = todayLocalDate(now);
  const dateChoice: DateChoice =
    transaction.localDate === today
      ? 'today'
      : transaction.localDate === localDateDaysBefore(today, 1)
      ? 'yesterday'
      : 'other';
  return {
    type: transaction.type,
    amount: formatMoneyInput(transaction.amountMinor, transaction.currency),
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    cardId: transaction.cardId,
    dateChoice,
    otherDate: dateChoice === 'other' ? transaction.localDate : '',
    payee: transaction.payee ?? '',
    description: transaction.description ?? '',
    note: transaction.note ?? '',
  };
}

/** The civil date the form describes, or null when "other" is not a real date. */
export function resolveLocalDate(
  values: TransactionFormValues,
  now: Date = new Date(),
): LocalDate | null {
  const today = todayLocalDate(now);
  switch (values.dateChoice) {
    case 'today':
      return today;
    case 'yesterday':
      return localDateDaysBefore(today, 1);
    case 'other': {
      const date = values.otherDate.trim();
      return isValidLocalDate(date) ? date : null;
    }
  }
}

const optionalText = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Turns form values into a domain input. Fields that do not apply to the type are cleared
 * (a transfer has no category, card or payee; an income has no card), the currency comes
 * from the account, and the domain's own field rules run (validateTransactionFields). Rules
 * that need stored data (card of the account, currencies, categories) run in the
 * repository and are mapped back with transactionFieldOfError.
 *
 * When editing, `previous` keeps its instant if the date did not change, and its origin
 * (source, status, externalRef).
 */
export function parseTransactionForm(
  values: TransactionFormValues,
  references: ReferenceLookup,
  previous: Transaction | null = null,
  now: Date = new Date(),
): TransactionFormResult {
  const errors: TransactionFormErrors = {};

  if (values.type === null) {
    errors.type = 'Elige el tipo de movimiento.';
  }

  const parsedAmount = parseMoney(
    values.amount,
    references.account(values.accountId)?.currency ?? 'GTQ',
  );
  if (!parsedAmount.ok) {
    errors.amount = MONEY_ERROR_MESSAGES[parsedAmount.error];
  }

  const account = references.account(values.accountId);
  if (!account) {
    errors.accountId =
      values.type === 'transfer'
        ? 'Elige la cuenta de origen.'
        : 'Elige una cuenta.';
  }

  const localDate = resolveLocalDate(values, now);
  if (localDate === null) {
    errors.date = TRANSACTION_ERROR_MESSAGES.local_date_invalid;
  }

  if (values.type === null || !account || localDate === null) {
    return { ok: false, errors };
  }

  const type = values.type;
  const isTransfer = type === 'transfer';
  const input: NewTransaction = {
    type,
    amountMinor: parsedAmount.ok ? parsedAmount.amountMinor : 0,
    currency: account.currency,
    accountId: account.id,
    toAccountId: isTransfer ? values.toAccountId : null,
    categoryId: isTransfer ? null : values.categoryId,
    cardId: type === 'expense' ? values.cardId : null,
    occurredAt:
      previous && previous.localDate === localDate
        ? previous.occurredAt
        : occurredAtFor(localDate, now),
    localDate,
    description: optionalText(values.description),
    payee: isTransfer ? null : optionalText(values.payee),
    note: optionalText(values.note),
    source: previous?.source ?? 'manual',
    status: previous?.status ?? 'confirmed',
    externalRef: previous?.externalRef ?? null,
  };

  for (const code of validateTransactionFields({
    ...input,
    id: previous?.id ?? '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  })) {
    // An unparsable amount already has a clearer message.
    if (FIELD_OF_ERROR[code] !== 'amount' || parsedAmount.ok) {
      errors[FIELD_OF_ERROR[code]] ??= TRANSACTION_ERROR_MESSAGES[code];
    }
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, input };
}
