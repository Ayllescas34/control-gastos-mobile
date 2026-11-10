import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
import { findAmount } from './messageAmount';
import type { CaptureKind } from './types';

/** What a bank SMS says, once parsed. Every part except kind and amount is optional. */
export type ParsedBankMessage = {
  kind: CaptureKind;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  /** Where the money went or came from ("SUPER LA TORRE JOCOTEN", "Agencia DIGITAL"). */
  merchant: string | null;
  /** The account as the bank names it ("TCREDITO", "BICHEQUE3"). */
  accountLabel: string | null;
  /** Authorization number: identifies the movement at the bank, so it deduplicates. */
  reference: string | null;
  /** When the bank says it happened; null when the message has no date. */
  occurredAt: Date | null;
};

/**
 * Operation words, by meaning. The FIRST one in the message decides, so "Consumo con
 * tarjeta de crédito" is an expense, not an income.
 */
const OPERATIONS: readonly [RegExp, CaptureKind][] = [
  [/\bretiros?\b/i, 'withdrawal'],
  [/\b(?:consumo|compra|cargo|d[eé]bito|pago|cobro)s?\b/i, 'expense'],
  [
    /\b(?:cr[eé]dito|dep[oó]sito|abono|acreditamiento|recibiste|transferencia recibida)s?\b/i,
    'income',
  ],
];

/** Codes, tokens and declined operations: not a movement. */
const NOT_A_MOVEMENT =
  /rechazad|declinad|denegad|fallid|no (?:fue|se pudo)|c[oó]digo de|token|contrase[nñ]a|\bclave\b|\bOTP\b/i;

/** "en SUPER LA TORRE", up to the account, the date, the authorization or the end. */
const MERCHANT =
  /\ben\s+(.+?)(?=\s+(?:cuenta|con\s+su\s+tarjeta|con\s+tarjeta|tarjeta)\b|\s+\d{1,2}[-/][A-Za-z0-9]{2,3}\b|\s+aut(?:orizaci[oó]n\b|\.)|\s*[.;]\s*$|$)/i;

/** "Cuenta TCREDITO", "con su tarjeta BICHEQUE3", "tarjeta ****1234" (upper case or digits). */
const ACCOUNT_LABEL =
  /\b(?:[Cc]uenta|[Tt]arjeta)\s+(?:[Nn]o\.?\s*|#\s*)?([A-Z0-9*•#][A-Z0-9*•#-]{2,})/;

/** A masked card number anywhere ("tarjeta de crédito ****1234"). */
const MASKED_NUMBER = /([*•#]{2,}\d{3,})/;

/** "Autorizacion 168554", "Aut.174582", "Autorización: 7349". */
const REFERENCE = /\baut(?:orizaci[oó]n)?\.?\s*:?\s*(\d{3,})/i;

/** "24-Oct 13:29", "07-Nov 15:26", "5/Dic/2026 08:00". */
const DATE_TIME =
  /\b(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*\.?(?:[-/ ](\d{2,4}))?\s+(\d{1,2}):(\d{2})\b/;

const MONTHS: Readonly<Record<string, number>> = {
  ene: 0,
  jan: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  aug: 7,
  sep: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
  dec: 11,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function kindOf(text: string): CaptureKind | null {
  let first: { index: number; kind: CaptureKind } | null = null;
  for (const [pattern, kind] of OPERATIONS) {
    const match = pattern.exec(text);
    if (match && (first === null || match.index < first.index)) {
      first = { index: match.index, kind };
    }
  }
  return first?.kind ?? null;
}

function cleanPlace(text: string | undefined): string | null {
  const place = text
    ?.replace(/\s+/g, ' ')
    .replace(/^(?:el|la|los|las)\s+/i, '')
    .trim();
  return place && place.length <= 80 ? place : null;
}

/**
 * The message's own date and time in the device's time zone. Banks often omit the year: it
 * is the one of `receivedAt`, or the previous one when that would put the movement in the
 * future (a December purchase reported in January).
 */
export function parseBankDate(text: string, receivedAt: Date): Date | null {
  const match = DATE_TIME.exec(text);
  if (!match) {
    return null;
  }
  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const month = MONTHS[monthText.toLowerCase()];
  if (month === undefined) {
    return null;
  }
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  let year = receivedAt.getFullYear();
  if (yearText !== undefined) {
    year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  }
  let date = new Date(year, month, day, hour, minute);
  if (
    yearText === undefined &&
    date.getTime() > receivedAt.getTime() + ONE_DAY_MS
  ) {
    date = new Date(year - 1, month, day, hour, minute);
  }
  const real =
    date.getMonth() === month &&
    date.getDate() === day &&
    hour < 24 &&
    minute < 60;
  return real ? date : null;
}

/**
 * Reads a bank SMS such as "BiMovil: Consumo por Q.28.25 en SUPER LA TORRE JOCOTEN Cuenta
 * BICHEQUE3 24-Oct 13:29 Autorizacion 168554.". Not tied to one bank: it looks for an
 * operation word, an amount with its currency, and optionally the place, the account name,
 * the date and the authorization (docs/bank-messages.md). Null when it is not a movement.
 */
export function parseBankMessage(
  text: string,
  receivedAt: Date,
): ParsedBankMessage | null {
  const message = text.replace(/\s+/g, ' ').trim();
  if (message === '' || NOT_A_MOVEMENT.test(message)) {
    return null;
  }
  const kind = kindOf(message);
  const amount = findAmount(message);
  if (kind === null || amount === null) {
    return null;
  }
  return {
    kind,
    amountMinor: amount.amountMinor,
    currency: amount.currency,
    merchant: cleanPlace(MERCHANT.exec(message.slice(amount.end))?.[1]),
    accountLabel:
      ACCOUNT_LABEL.exec(message)?.[1] ?? MASKED_NUMBER.exec(message)?.[1] ?? null,
    reference: REFERENCE.exec(message)?.[1] ?? null,
    occurredAt: parseBankDate(message, receivedAt),
  };
}

/** Upper case, accents removed: the form identifiers are compared in. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

function mentions(text: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(text);
}

/**
 * The single account a message belongs to, by the identifiers the user wrote on each
 * account (Account.bankLabel). The account name the bank used wins; otherwise any
 * identifier mentioned in the text. Null when none or several accounts match.
 */
export function matchAccountByLabel<T extends { labels: readonly string[] }>(
  message: string,
  accountLabel: string | null,
  accounts: readonly T[],
): T | null {
  if (accountLabel !== null) {
    const exact = accounts.filter(account =>
      account.labels.includes(normalize(accountLabel)),
    );
    if (exact.length === 1) {
      return exact[0];
    }
  }
  const text = normalize(message);
  const mentioned = accounts.filter(account =>
    account.labels.some(label => mentions(text, normalize(label))),
  );
  return mentioned.length === 1 ? mentioned[0] : null;
}
