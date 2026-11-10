import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import {
  accounts,
  cards,
  categories,
  generateId,
  notDeleted,
  transactions,
  walletCaptures,
  type AppDatabase,
  type Database,
  type WalletCaptureRow,
} from '../../../core/db';
import {
  GOOGLE_WALLET_PACKAGE,
  type RawWalletNotification,
} from '../../../core/native/walletCaptures';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime, toLocalDate } from '../../../shared/lib/dates';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
// By module, not the feature indexes, to keep features free of import cycles.
import { parseBankLabels } from '../../accounts/domain/validateAccount';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../transactions/data/transactionRepository';
import type {
  Transaction,
  TransactionType,
} from '../../transactions/domain/types';
import {
  matchAccountByLabel,
  parseBankMessage,
} from '../domain/parseBankMessage';
import { parseWalletNotification } from '../domain/parseWalletNotification';
import type {
  CaptureKind,
  WalletCapture,
  WalletCaptureStatus,
} from '../domain/types';

/** The capture was already registered or dismissed, or does not exist. */
export class WalletCaptureNotAvailableError extends Error {
  constructor() {
    super('Wallet capture not available');
    this.name = 'WalletCaptureNotAvailableError';
  }
}

/**
 * Two notices of the same movement (Google Wallet and the bank's SMS, or the two SMS a bank
 * sends for one ATM withdrawal) arrive within minutes of each other.
 */
export const SAME_MOVEMENT_WINDOW_MS = 10 * 60 * 1000;

function rowToCapture(row: WalletCaptureRow): WalletCapture {
  return {
    id: row.id,
    externalRef: row.externalRef,
    sourceApp: row.sourceApp,
    rawTitle: row.rawTitle,
    rawText: row.rawText,
    merchant: row.merchant,
    amountMinor: row.amountMinor,
    currency: row.currency,
    cardLast4: row.cardLast4,
    accountLabel: row.accountLabel,
    kind: row.kind as CaptureKind,
    postedAt: row.postedAt,
    status: row.status as WalletCaptureStatus,
    transactionId: row.transactionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** A captured movement, whatever app it came from. */
type ParsedCapture = {
  kind: CaptureKind;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  merchant: string | null;
  cardLast4: string | null;
  accountLabel: string | null;
  /** Bank authorization number, when the message has one. */
  reference: string | null;
  occurredAt: Date;
};

/** Google Wallet notifications and bank SMS, each with its own reader. */
export function parseCapture(raw: RawWalletNotification): ParsedCapture | null {
  const received = new Date(raw.postedAt);
  if (raw.packageName === GOOGLE_WALLET_PACKAGE) {
    const payment = parseWalletNotification(raw);
    return payment
      ? {
          ...payment,
          kind: 'expense',
          accountLabel: null,
          reference: null,
          occurredAt: received,
        }
      : null;
  }
  const text = [raw.text, raw.bigText].filter(Boolean).join('\n');
  const message = parseBankMessage(text, received);
  if (!message) {
    return null;
  }
  // "****1234" in a bank message also identifies a card.
  const maskedDigits = message.accountLabel?.match(/^[*•#]+\d*(\d{4})$/);
  return {
    kind: message.kind,
    amountMinor: message.amountMinor,
    currency: message.currency,
    merchant: message.merchant,
    cardLast4: maskedDigits?.[1] ?? null,
    accountLabel: message.accountLabel,
    reference: message.reference,
    occurredAt: message.occurredAt ?? received,
  };
}

/**
 * The capture's id for deduplication. A bank's authorization number identifies the movement
 * even when the same SMS arrives twice; otherwise the notification's own id.
 */
function externalRefOf(raw: RawWalletNotification, parsed: ParsedCapture) {
  return parsed.reference === null
    ? raw.id
    : `ref:${parsed.reference}:${parsed.amountMinor}`;
}

/** Where a capture belongs: an account, and the card when it is known. */
export type CaptureTarget = {
  accountId: EntityId;
  cardId: EntityId | null;
  currency: CurrencyCode;
};

type TargetHints = {
  cardLast4: string | null;
  accountLabel: string | null;
  text: string;
};

/**
 * The account of a capture: the single active card with its last four digits, otherwise the
 * single active account whose bank identifiers (Account.bankLabel) the message mentions. A
 * bank message on an account with a single card is put on that card.
 */
export async function resolveCaptureTarget(
  db: AppDatabase,
  hints: TargetHints,
): Promise<CaptureTarget | null> {
  if (hints.cardLast4) {
    const matches = await db
      .select({
        cardId: cards.id,
        accountId: cards.accountId,
        currency: accounts.currency,
      })
      .from(cards)
      .innerJoin(accounts, eq(accounts.id, cards.accountId))
      .where(
        and(
          eq(cards.last4, hints.cardLast4),
          notDeleted(cards),
          notDeleted(accounts),
        ),
      );
    if (matches.length === 1) {
      return matches[0];
    }
  }

  const labelled = await db
    .select({
      id: accounts.id,
      currency: accounts.currency,
      bankLabel: accounts.bankLabel,
    })
    .from(accounts)
    .where(and(notDeleted(accounts), isNotNull(accounts.bankLabel)));
  const account = matchAccountByLabel(
    hints.text,
    hints.accountLabel,
    labelled.map(row => ({ ...row, labels: parseBankLabels(row.bankLabel) })),
  );
  if (!account) {
    return null;
  }
  const accountCards = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.accountId, account.id), notDeleted(cards)));
  return {
    accountId: account.id,
    cardId: accountCards.length === 1 ? accountCards[0].id : null,
    currency: account.currency,
  };
}

/**
 * Category of the latest movement of the same type at the same merchant (ignoring case), if
 * that category is still active: "Starbucks" keeps landing in "Café" once the user chose it.
 */
export async function suggestCategoryForMerchant(
  db: AppDatabase,
  merchant: string | null,
  type: 'expense' | 'income' = 'expense',
): Promise<EntityId | null> {
  if (!merchant) {
    return null;
  }
  const row = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        notDeleted(transactions),
        notDeleted(categories),
        eq(transactions.type, type),
        sql`lower(${transactions.payee}) = lower(${merchant})`,
      ),
    )
    .orderBy(desc(transactions.occurredAt))
    .limit(1)
    .get();
  return row?.categoryId ?? null;
}

/** The single active cash account in `currency`: where an ATM withdrawal's money goes. */
export async function findCashAccount(
  db: AppDatabase,
  currency: CurrencyCode,
): Promise<EntityId | null> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        notDeleted(accounts),
        eq(accounts.type, 'cash'),
        eq(accounts.currency, currency),
      ),
    );
  return rows.length === 1 ? rows[0].id : null;
}

/** Movement types a capture of each kind can be. */
const TYPES_OF_KIND: Record<CaptureKind, TransactionType[]> = {
  expense: ['expense', 'transfer'],
  withdrawal: ['transfer', 'expense'],
  income: ['income'],
};

/**
 * A movement already registered from another notice of the same event: same amount and
 * currency, a compatible type, within SAME_MOVEMENT_WINDOW_MS, and on the same account when
 * the account is known.
 */
async function findSameMovement(
  tx: AppDatabase,
  parsed: ParsedCapture,
  accountId: EntityId | null,
): Promise<EntityId | null> {
  const time = parsed.occurredAt.getTime();
  const row = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        notDeleted(transactions),
        eq(transactions.source, 'notification'),
        eq(transactions.amountMinor, parsed.amountMinor),
        eq(transactions.currency, parsed.currency),
        inArray(transactions.type, TYPES_OF_KIND[parsed.kind]),
        gte(
          transactions.occurredAt,
          new Date(time - SAME_MOVEMENT_WINDOW_MS).toISOString(),
        ),
        lte(
          transactions.occurredAt,
          new Date(time + SAME_MOVEMENT_WINDOW_MS).toISOString(),
        ),
        accountId === null ? undefined : eq(transactions.accountId, accountId),
      ),
    )
    .limit(1)
    .get();
  return row?.id ?? null;
}

/**
 * Captures in the inbox that describe `transaction` (same amount and direction, within the
 * window) become linked to it: the other notice of the same event, e.g. the "Debito …
 * CAJEROS AUTOMATICOS" SMS a bank sends next to "Retiro … con su tarjeta".
 */
async function linkWaitingNotices(
  tx: AppDatabase,
  transaction: Transaction,
  kind: CaptureKind,
): Promise<void> {
  const time = new Date(transaction.occurredAt).getTime();
  const kinds: CaptureKind[] =
    kind === 'income' ? ['income'] : ['expense', 'withdrawal'];
  await tx
    .update(walletCaptures)
    .set({
      status: 'registered',
      transactionId: transaction.id,
      updatedAt: nowIsoDateTime(),
    })
    .where(
      and(
        eq(walletCaptures.status, 'new'),
        notDeleted(walletCaptures),
        eq(walletCaptures.amountMinor, transaction.amountMinor),
        eq(walletCaptures.currency, transaction.currency),
        inArray(walletCaptures.kind, kinds),
        gte(
          walletCaptures.postedAt,
          new Date(time - SAME_MOVEMENT_WINDOW_MS).toISOString(),
        ),
        lte(
          walletCaptures.postedAt,
          new Date(time + SAME_MOVEMENT_WINDOW_MS).toISOString(),
        ),
      ),
    );
}

/** Wallet captures persistence. Reads exclude soft-deleted rows (none are deleted today). */
export function createWalletCaptureRepository(db: AppDatabase) {
  return {
    async getById(id: EntityId): Promise<WalletCapture | null> {
      const row = await db
        .select()
        .from(walletCaptures)
        .where(and(eq(walletCaptures.id, id), notDeleted(walletCaptures)))
        .get();
      return row ? rowToCapture(row) : null;
    },

    /** Captures waiting in "Por registrar", newest first. */
    async listNew(): Promise<WalletCapture[]> {
      const rows = await db
        .select()
        .from(walletCaptures)
        .where(
          and(eq(walletCaptures.status, 'new'), notDeleted(walletCaptures)),
        )
        .orderBy(desc(walletCaptures.postedAt));
      return rows.map(rowToCapture);
    },

    /** "Not a movement": leaves the inbox, keeps the evidence. */
    async dismiss(id: EntityId): Promise<boolean> {
      const rows = await db
        .update(walletCaptures)
        .set({ status: 'dismissed', updatedAt: nowIsoDateTime() })
        .where(
          and(
            eq(walletCaptures.id, id),
            eq(walletCaptures.status, 'new'),
            notDeleted(walletCaptures),
          ),
        )
        .returning({ id: walletCaptures.id });
      return rows.length > 0;
    },

    /** Where the capture would be registered, for the prefilled form. */
    target(capture: WalletCapture): Promise<CaptureTarget | null> {
      return resolveCaptureTarget(db, {
        cardLast4: capture.cardLast4,
        accountLabel: capture.accountLabel,
        text: capture.rawText ?? '',
      });
    },

    suggestCategory(
      merchant: string | null,
      type: 'expense' | 'income' = 'expense',
    ): Promise<EntityId | null> {
      return suggestCategoryForMerchant(db, merchant, type);
    },

    cashAccount(currency: CurrencyCode): Promise<EntityId | null> {
      return findCashAccount(db, currency);
    },
  };
}

export type WalletCaptureRepository = ReturnType<
  typeof createWalletCaptureRepository
>;

type CaptureOutcome = 'registered' | 'merged' | 'stored' | 'duplicate';

async function insertCapture(
  tx: AppDatabase,
  raw: RawWalletNotification,
  parsed: ParsedCapture,
  transactionId: EntityId | null,
): Promise<void> {
  const now = nowIsoDateTime();
  await tx.insert(walletCaptures).values({
    id: await generateId(tx),
    externalRef: externalRefOf(raw, parsed),
    sourceApp: raw.packageName,
    rawTitle: raw.title,
    rawText: raw.bigText ?? raw.text,
    merchant: parsed.merchant,
    amountMinor: parsed.amountMinor,
    currency: parsed.currency,
    cardLast4: parsed.cardLast4,
    accountLabel: parsed.accountLabel,
    kind: parsed.kind,
    postedAt: parsed.occurredAt.toISOString(),
    status: transactionId ? 'registered' : 'new',
    transactionId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/** The movement a capture becomes on `target`, or null when it cannot be registered alone. */
async function movementFor(
  tx: AppDatabase,
  parsed: ParsedCapture,
  target: CaptureTarget,
  reference: string,
): Promise<NewTransaction | null> {
  const common = {
    amountMinor: parsed.amountMinor,
    currency: parsed.currency,
    accountId: target.accountId,
    occurredAt: parsed.occurredAt.toISOString(),
    localDate: toLocalDate(parsed.occurredAt),
    note: null,
    source: 'notification' as const,
    status: 'pending' as const,
    externalRef: reference,
  };
  switch (parsed.kind) {
    case 'expense':
      return {
        ...common,
        type: 'expense',
        toAccountId: null,
        categoryId: await suggestCategoryForMerchant(tx, parsed.merchant),
        cardId: target.cardId,
        description: null,
        payee: parsed.merchant,
      };
    case 'income':
      return {
        ...common,
        type: 'income',
        toAccountId: null,
        categoryId: await suggestCategoryForMerchant(
          tx,
          parsed.merchant,
          'income',
        ),
        cardId: null,
        description: null,
        payee: parsed.merchant,
      };
    case 'withdrawal': {
      // Cash taken out is not spent: it moves to the cash account.
      const cash = await findCashAccount(tx, parsed.currency);
      if (cash === null || cash === target.accountId) {
        return null;
      }
      return {
        ...common,
        type: 'transfer',
        toAccountId: cash,
        categoryId: null,
        cardId: null,
        description: parsed.merchant
          ? `Retiro en ${parsed.merchant}`
          : 'Retiro de efectivo',
        payee: null,
      };
    }
  }
}

/**
 * Stores one captured movement and, when its account is known, registers it `pending` review.
 * A second notice of an already registered movement is linked to it instead. Atomic: the
 * movement and its capture are written together.
 */
async function importOne(
  database: Database,
  raw: RawWalletNotification,
  parsed: ParsedCapture,
): Promise<CaptureOutcome> {
  return database.withTransaction(async tx => {
    const reference = externalRefOf(raw, parsed);
    const existing = await tx
      .select({ id: walletCaptures.id })
      .from(walletCaptures)
      .where(eq(walletCaptures.externalRef, reference))
      .get();
    if (existing) {
      return 'duplicate';
    }

    const found = await resolveCaptureTarget(tx, {
      cardLast4: parsed.cardLast4,
      accountLabel: parsed.accountLabel,
      text: [raw.text, raw.bigText].filter(Boolean).join('\n'),
    });
    const target = found && found.currency === parsed.currency ? found : null;

    const same = await findSameMovement(tx, parsed, target?.accountId ?? null);
    if (same !== null) {
      await insertCapture(tx, raw, parsed, same);
      return 'merged';
    }

    const input = target ? await movementFor(tx, parsed, target, reference) : null;
    if (!input) {
      await insertCapture(tx, raw, parsed, null);
      return 'stored';
    }
    const transaction = await createTransactionRepository(tx).create(input);
    await insertCapture(tx, raw, parsed, transaction.id);
    await linkWaitingNotices(tx, transaction, parsed.kind);
    return 'registered';
  });
}

/** Only into the inbox (used when the automatic path fails validation). */
function storeOnly(
  database: Database,
  raw: RawWalletNotification,
  parsed: ParsedCapture,
): Promise<CaptureOutcome> {
  return database.withTransaction(async tx => {
    const existing = await tx
      .select({ id: walletCaptures.id })
      .from(walletCaptures)
      .where(eq(walletCaptures.externalRef, externalRefOf(raw, parsed)))
      .get();
    if (existing) {
      return 'duplicate';
    }
    await insertCapture(tx, raw, parsed, null);
    return 'stored';
  });
}

export type WalletImportResult = {
  /** Native ids that can be acknowledged: stored, duplicated or not a movement. */
  processedIds: string[];
  /** Became a movement pending review. */
  registered: number;
  /** Waiting in "Por registrar". */
  stored: number;
};

/** Error name only: the message may carry SQL parameters (amounts, merchants). */
function logSafely(context: string, error: unknown): void {
  console.error(context, error instanceof Error ? error.name : 'unknown');
}

/**
 * Imports queued notifications. Each movement is stored once (deduplicated by its bank
 * reference or native id, and merged with other notices of the same event); notifications
 * that are not movements are only acknowledged. A notification that cannot be written stays
 * unacknowledged, so the next sync retries it.
 */
export async function importWalletNotifications(
  database: Database,
  notifications: readonly RawWalletNotification[],
): Promise<WalletImportResult> {
  const result: WalletImportResult = {
    processedIds: [],
    registered: 0,
    stored: 0,
  };
  // Oldest first, so the first notice of an event is the one that registers it.
  const ordered = [...notifications].sort((a, b) => a.postedAt - b.postedAt);
  for (const raw of ordered) {
    const parsed = parseCapture(raw);
    if (!parsed) {
      result.processedIds.push(raw.id);
      continue;
    }
    let outcome: CaptureOutcome;
    try {
      outcome = await importOne(database, raw, parsed);
    } catch (error) {
      logSafely('Automatic capture registration failed', error);
      try {
        outcome = await storeOnly(database, raw, parsed);
      } catch (storeError) {
        logSafely('Storing capture failed', storeError);
        continue;
      }
    }
    result.processedIds.push(raw.id);
    if (outcome === 'registered') {
      result.registered += 1;
    } else if (outcome === 'stored') {
      result.stored += 1;
    }
  }
  return result;
}

/**
 * Retries the inbox: captures that could not be placed when they arrived are registered once
 * their account becomes known (the user added the identifier "TCREDITO" to an account, or
 * the card). Same rules and atomicity as a new capture. Returns how many were registered.
 */
export async function registerWaitingCaptures(
  database: Database,
): Promise<number> {
  const waiting = await createWalletCaptureRepository(database.db).listNew();
  let registered = 0;
  // Oldest first, like new notifications.
  for (const capture of [...waiting].reverse()) {
    try {
      const done = await database.withTransaction(async tx => {
        const current = await tx
          .select({ status: walletCaptures.status })
          .from(walletCaptures)
          .where(eq(walletCaptures.id, capture.id))
          .get();
        if (current?.status !== 'new') {
          return false;
        }
        const found = await resolveCaptureTarget(tx, {
          cardLast4: capture.cardLast4,
          accountLabel: capture.accountLabel,
          text: capture.rawText ?? '',
        });
        if (!found || found.currency !== capture.currency) {
          return false;
        }
        const parsed: ParsedCapture = {
          kind: capture.kind,
          amountMinor: capture.amountMinor,
          currency: capture.currency,
          merchant: capture.merchant,
          cardLast4: capture.cardLast4,
          accountLabel: capture.accountLabel,
          reference: null,
          occurredAt: new Date(capture.postedAt),
        };
        const same = await findSameMovement(tx, parsed, found.accountId);
        let transactionId = same;
        if (transactionId === null) {
          const input = await movementFor(tx, parsed, found, capture.externalRef);
          if (!input) {
            return false;
          }
          const transaction = await createTransactionRepository(tx).create(input);
          transactionId = transaction.id;
        }
        await tx
          .update(walletCaptures)
          .set({
            status: 'registered',
            transactionId,
            updatedAt: nowIsoDateTime(),
          })
          .where(eq(walletCaptures.id, capture.id));
        return true;
      });
      if (done) {
        registered += 1;
      }
    } catch (error) {
      logSafely('Retrying a waiting capture failed', error);
    }
  }
  return registered;
}

/**
 * The user reviewed a capture in the movement form: creates the movement (confirmed, with
 * the capture's origin) and links the capture to it, in one transaction.
 */
export function registerWalletCapture(
  database: Database,
  captureId: EntityId,
  input: NewTransaction,
): Promise<Transaction> {
  return database.withTransaction(async tx => {
    const row = await tx
      .select()
      .from(walletCaptures)
      .where(
        and(
          eq(walletCaptures.id, captureId),
          eq(walletCaptures.status, 'new'),
          notDeleted(walletCaptures),
        ),
      )
      .get();
    if (!row) {
      throw new WalletCaptureNotAvailableError();
    }
    const transaction = await createTransactionRepository(tx).create({
      ...input,
      source: 'notification',
      status: 'confirmed',
      externalRef: row.externalRef,
    });
    await tx
      .update(walletCaptures)
      .set({
        status: 'registered',
        transactionId: transaction.id,
        updatedAt: nowIsoDateTime(),
      })
      .where(eq(walletCaptures.id, captureId));
    return transaction;
  });
}
