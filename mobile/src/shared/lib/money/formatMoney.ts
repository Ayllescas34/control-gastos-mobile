import { appConfig } from '../../../core/config/appConfig';

/** ISO 4217 currency code, e.g. "GTQ". */
export type CurrencyCode = string;

/** Integer amount in the currency's minor unit (e.g. centavos). Never a decimal float. */
export type MinorUnits = number;

const MINOR_UNIT_DIGITS: Record<CurrencyCode, number> = {
  GTQ: 2,
  USD: 2,
};

/**
 * Presentation only: converts minor units to a localized currency string.
 * The division happens solely to build the display text; amounts are always stored as integers.
 */
export function formatMoney(
  amountMinor: MinorUnits,
  currency: CurrencyCode,
  locale: string = appConfig.locale,
): string {
  const digits = MINOR_UNIT_DIGITS[currency] ?? 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}
