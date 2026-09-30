import type {
  EntityId,
  IsoDateTime,
  LocalDate,
  Timestamps,
} from '../../../shared/domain';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionSource = 'manual' | 'import' | 'notification' | 'api';

export type TransactionStatus = 'confirmed' | 'pending';

/**
 * Domain rules: docs/domain-model.md. Invariants are checked by validateTransaction.
 * - transfer: accountId = origin, toAccountId = destination (card payments included).
 * - expense paid with a card: accountId = account backing the card, cardId = plastic used.
 */
export type Transaction = Timestamps & {
  id: EntityId;
  type: TransactionType;
  /** Always a positive integer; the sign is given by `type`. */
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  accountId: EntityId;
  toAccountId: EntityId | null;
  categoryId: EntityId | null;
  cardId: EntityId | null;
  /** UTC instant. */
  occurredAt: IsoDateTime;
  /** Civil date in the device time zone when recorded. */
  localDate: LocalDate;
  description: string | null;
  payee: string | null;
  note: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  externalRef: string | null;
};
