/** ISO 4217 currency code, e.g. "GTQ". */
export type CurrencyCode = string;

/** Integer amount in the currency's minor unit (e.g. centavos). Never a decimal float. */
export type MinorUnits = number;

/** ISO 4217 shape: three uppercase letters. */
const CURRENCY_CODE = /^[A-Z]{3}$/;

/** Whether `value` has the shape of a currency code (the same rule as the DB CHECK). */
export function isCurrencyCode(value: string): boolean {
  return CURRENCY_CODE.test(value);
}

const MINOR_UNIT_DIGITS: Record<CurrencyCode, number> = {
  GTQ: 2,
  USD: 2,
};

/** Decimal digits of the currency's minor unit (2 for GTQ: 1 quetzal = 100 centavos). */
export function minorUnitDigits(currency: CurrencyCode): number {
  return MINOR_UNIT_DIGITS[currency] ?? 2;
}
