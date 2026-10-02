/** ISO 4217 currency code, e.g. "GTQ". */
export type CurrencyCode = string;

/** Integer amount in the currency's minor unit (e.g. centavos). Never a decimal float. */
export type MinorUnits = number;

const MINOR_UNIT_DIGITS: Record<CurrencyCode, number> = {
  GTQ: 2,
  USD: 2,
};

/** Decimal digits of the currency's minor unit (2 for GTQ: 1 quetzal = 100 centavos). */
export function minorUnitDigits(currency: CurrencyCode): number {
  return MINOR_UNIT_DIGITS[currency] ?? 2;
}
