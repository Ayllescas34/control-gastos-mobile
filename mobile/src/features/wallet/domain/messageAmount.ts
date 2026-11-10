import {
  minorUnitDigits,
  type CurrencyCode,
} from '../../../shared/lib/money';

/**
 * Currency marks as payment apps and banks write them, longest first so "US$" wins over
 * "$". "$" alone is read as USD: in Guatemala the quetzal is always "Q" ("Q45.00",
 * "Q.28.25", "Q. 80.00").
 */
const CURRENCY_MARKS: readonly [string, CurrencyCode][] = [
  ['US$', 'USD'],
  ['MX$', 'MXN'],
  ['USD', 'USD'],
  ['GTQ', 'GTQ'],
  ['MXN', 'MXN'],
  ['EUR', 'EUR'],
  ['€', 'EUR'],
  ['$', 'USD'],
  ['Q', 'GTQ'],
];

const escape = (text: string) => text.replace(/[$]/g, '\\$');
const MARK = `(${CURRENCY_MARKS.map(([mark]) => escape(mark)).join('|')})`;
/** 1,234.56 · 1.234,56 · 1 234,56 · 45 · 45.5 */
const NUMBER =
  '(\\d{1,3}(?:[.,\\u00a0 ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
// The mark must not be the tail of a word ("BBQ 45" is not quetzales). Banks may put a dot
// and a space after it ("Q. 80.00").
const PREFIXED = new RegExp(`(?:^|[^A-Za-z])${MARK}\\.?\\s?${NUMBER}`);
const SUFFIXED = new RegExp(`${NUMBER}\\s?${MARK}(?![A-Za-z])`);

const currencyOf = (mark: string): CurrencyCode =>
  CURRENCY_MARKS.find(([candidate]) => candidate === mark)?.[1] ?? 'USD';

/**
 * Exact minor units from a localized number, with string and integer operations only. The
 * last "." or "," followed by 1–2 digits is the decimal separator; any other separator groups
 * thousands.
 */
export function amountToMinor(
  number: string,
  currency: CurrencyCode,
): number | null {
  const compact = number.replace(/[  ]/g, '');
  const decimal = /[.,](\d{1,2})$/.exec(compact);
  const whole = (decimal ? compact.slice(0, decimal.index) : compact).replace(
    /[.,]/g,
    '',
  );
  if (!/^\d+$/.test(whole)) {
    return null;
  }
  const digits = minorUnitDigits(currency);
  const fraction = (decimal?.[1] ?? '').padEnd(digits, '0').slice(0, digits);
  const amount = Number(`${whole}${fraction}`);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export type FoundAmount = {
  amountMinor: number;
  currency: CurrencyCode;
  /** Where the amount ends in the text, to read what follows it. */
  end: number;
};

/** The first amount with a currency mark in `text`, or null. */
export function findAmount(text: string): FoundAmount | null {
  const prefixed = PREFIXED.exec(text);
  const suffixed = SUFFIXED.exec(text);
  const found = prefixed
    ? { mark: prefixed[1], number: prefixed[2], match: prefixed }
    : suffixed
    ? { mark: suffixed[2], number: suffixed[1], match: suffixed }
    : null;
  if (!found) {
    return null;
  }
  const currency = currencyOf(found.mark);
  const amountMinor = amountToMinor(found.number, currency);
  return amountMinor === null
    ? null
    : {
        amountMinor,
        currency,
        end: found.match.index + found.match[0].length,
      };
}
