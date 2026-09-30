import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionSource = 'manual' | 'import' | 'notification' | 'api';

export type TransactionStatus = 'confirmed' | 'pending';

/**
 * Conceptual model only; persistence and business rules come in later phases.
 * - transfer: accountId = origin, toAccountId = destination (card payments included).
 * - expense paid with a card: accountId = account backing the card, cardId = plastic used.
 */
export type Transaction = {
  id: string;
  type: TransactionType;
  /** Always a positive integer; the sign is given by `type`. */
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  cardId: string | null;
  /** UTC instant, ISO 8601. */
  occurredAt: string;
  /** Civil date in the device time zone when recorded, "YYYY-MM-DD". */
  localDate: string;
  description: string | null;
  payee: string | null;
  note: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
