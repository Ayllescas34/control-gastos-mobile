import { findAmount } from './messageAmount';
import type { ParsedWalletPayment } from './types';

export { amountToMinor } from './messageAmount';

export type WalletNotificationText = {
  title: string | null;
  text: string | null;
  bigText: string | null;
};

/** "•••• 1234", "**1234", "···1234", "terminada en 1234", "ending in 1234". */
const LAST4 =
  /(?:[•·*●∙x]{2,}\s?|terminada en\s|termina en\s|terminación\s|ending in\s)(\d{4})\b/i;

/** Wording of refunds and declines: not an expense, so not captured as one. */
const NOT_A_PAYMENT =
  /reembolso|devoluci[oó]n|refund|rechazad|declined|no se (?:pudo|complet)/i;

/** "at Starbucks" / "en Starbucks", up to "with"/"con" or the end. */
const MERCHANT_IN_TEXT = /\b(?:at|en)\s+(.+?)(?:\s+(?:with|con)\b|[.,]?$)/i;

/** Titles that name the app, not the merchant. */
const APP_TITLE = /^(?:google\s*)?(?:wallet|pay)$/i;

function cleanMerchant(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim() ?? '';
  return trimmed.length > 0 && trimmed.length <= 80 ? trimmed : null;
}

/**
 * Reads a Google Wallet notification. Returns null when it is not a payment (pass added,
 * refund, promotion...). Wallet usually puts the merchant in the title and
 * "Q45.00 con Visa •••• 1234" in the text, but wording varies by version and language, so
 * every part is optional except an amount with its currency mark.
 */
export function parseWalletNotification(
  notification: WalletNotificationText,
): ParsedWalletPayment | null {
  const { title, text, bigText } = notification;
  const body = [text, bigText].filter(Boolean).join('\n');
  const all = [title, body].filter(Boolean).join('\n');
  if (all.trim() === '' || NOT_A_PAYMENT.test(all)) {
    return null;
  }

  const amount = findAmount(body) ?? findAmount(title ?? '');
  if (!amount) {
    return null;
  }

  const titleHasAmount = title !== null && findAmount(title) !== null;
  const titleIsApp = title !== null && APP_TITLE.test(title.trim());
  const fromBody = () => cleanMerchant(MERCHANT_IN_TEXT.exec(body)?.[1]);
  const merchant = titleHasAmount
    ? cleanMerchant(MERCHANT_IN_TEXT.exec(title ?? '')?.[1])
    : titleIsApp
    ? fromBody()
    : cleanMerchant(title) ?? fromBody();

  return {
    merchant,
    amountMinor: amount.amountMinor,
    currency: amount.currency,
    cardLast4: LAST4.exec(all)?.[1] ?? null,
  };
}
