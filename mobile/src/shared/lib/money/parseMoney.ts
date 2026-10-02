import {
  minorUnitDigits,
  type CurrencyCode,
  type MinorUnits,
} from './currency';

export type ParseMoneyResult =
  | { ok: true; amountMinor: MinorUnits }
  | {
      ok: false;
      error: 'empty' | 'invalid' | 'too_many_decimals' | 'too_large';
    };

/** Optional sign, digits with optional "," grouping, optional "." decimals. */
const AMOUNT_PATTERN = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d*))?$/;

/**
 * Parses user input such as "12,500.50" or "-300" into exact minor units (1250050, -30000)
 * using only string and integer operations: no floating point is involved, so amounts
 * never pick up rounding errors. "." is the decimal separator and "," groups thousands
 * (es-GT). More decimals than the currency allows are rejected, not rounded.
 */
export function parseMoney(
  input: string,
  currency: CurrencyCode,
): ParseMoneyResult {
  const text = input.trim();
  if (text === '') {
    return { ok: false, error: 'empty' };
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) {
    return { ok: false, error: 'invalid' };
  }
  const [, sign, wholeGroup, fraction = ''] = match;

  const digits = minorUnitDigits(currency);
  if (fraction.length > digits) {
    return { ok: false, error: 'too_many_decimals' };
  }

  const whole = wholeGroup.replace(/,/g, '');
  const minorDigits = `${whole}${fraction.padEnd(digits, '0')}`;
  const amount = Number(minorDigits);
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, error: 'too_large' };
  }

  // `|| 0` turns -0 into 0.
  return { ok: true, amountMinor: (sign ? -amount : amount) || 0 };
}

/**
 * Minor units as plain editable text ("1250050" → "12500.50"), the inverse of parseMoney
 * without grouping, so an edit form can prefill an amount field.
 */
export function formatMoneyInput(
  amountMinor: MinorUnits,
  currency: CurrencyCode,
): string {
  const digits = minorUnitDigits(currency);
  const absolute = String(Math.abs(amountMinor)).padStart(digits + 1, '0');
  const whole = absolute.slice(0, absolute.length - digits);
  const fraction = absolute.slice(absolute.length - digits);
  const sign = amountMinor < 0 ? '-' : '';
  return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}
