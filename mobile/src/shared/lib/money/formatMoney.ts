import { appConfig } from '../../../core/config/appConfig';
import {
  minorUnitDigits,
  type CurrencyCode,
  type MinorUnits,
} from './currency';

/**
 * Presentation only: converts minor units to a localized currency string.
 * The division happens solely to build the display text; amounts are always stored as integers.
 */
export function formatMoney(
  amountMinor: MinorUnits,
  currency: CurrencyCode,
  locale: string = appConfig.locale,
): string {
  const digits = minorUnitDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}
