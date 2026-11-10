import {
  amountToMinor,
  parseWalletNotification,
} from '../../src/features/wallet/domain/parseWalletNotification';
import { parseRawNotifications } from '../../src/core/native/walletCaptures';

const notification = (
  title: string | null,
  text: string | null,
  bigText: string | null = null,
) => ({ title, text, bigText });

describe('parseWalletNotification', () => {
  it('reads merchant from the title and amount and card from the text', () => {
    expect(
      parseWalletNotification(
        notification('Starbucks Oakland', 'Q45.00 con Visa •••• 1234'),
      ),
    ).toEqual({
      merchant: 'Starbucks Oakland',
      amountMinor: 4500,
      currency: 'GTQ',
      cardLast4: '1234',
    });
  });

  it('understands English wording and a merchant inside the text', () => {
    expect(
      parseWalletNotification(
        notification(
          'Google Wallet',
          'You paid US$12.50 at Uber with Mastercard ••5678',
        ),
      ),
    ).toEqual({
      merchant: 'Uber',
      amountMinor: 1250,
      currency: 'USD',
      cardLast4: '5678',
    });
    expect(
      parseWalletNotification(
        notification('Pagaste Q 1,250.75 en Super 24', 'Visa terminada en 0042'),
      ),
    ).toEqual({
      merchant: 'Super 24',
      amountMinor: 125075,
      currency: 'GTQ',
      cardLast4: '0042',
    });
  });

  it('reads the amount from the expanded text when the short one lacks it', () => {
    expect(
      parseWalletNotification(
        notification('Pollo Campero', 'Pago completado', 'GTQ 89.5 · ****9876'),
      ),
    ).toMatchObject({ amountMinor: 8950, currency: 'GTQ', cardLast4: '9876' });
  });

  it('accepts a currency after the number and European separators', () => {
    expect(
      parseWalletNotification(notification('Café', '1.234,56 € con Visa')),
    ).toMatchObject({ amountMinor: 123456, currency: 'EUR', cardLast4: null });
  });

  it('ignores notifications that are not payments', () => {
    expect(
      parseWalletNotification(notification('Pase agregado', 'Tu boleto está listo')),
    ).toBeNull();
    expect(
      parseWalletNotification(notification('Reembolso', 'Q45.00 a Visa •••• 1234')),
    ).toBeNull();
    expect(
      parseWalletNotification(notification('Pago rechazado', 'Q45.00 con Visa')),
    ).toBeNull();
    expect(parseWalletNotification(notification(null, null))).toBeNull();
  });

  it('does not mistake a word ending in Q or the card digits for an amount', () => {
    expect(
      parseWalletNotification(notification('BBQ 45', 'Visa •••• 1234')),
    ).toBeNull();
  });
});

describe('amountToMinor', () => {
  it('uses integer arithmetic only', () => {
    expect(amountToMinor('0.10', 'GTQ')).toBe(10);
    expect(amountToMinor('1,000', 'GTQ')).toBe(100000);
    expect(amountToMinor('1 000,5', 'EUR')).toBe(100050);
    expect(amountToMinor('19.99', 'USD')).toBe(1999);
  });

  it('rejects zero and unsafe amounts', () => {
    expect(amountToMinor('0', 'GTQ')).toBeNull();
    expect(amountToMinor('99999999999999999', 'GTQ')).toBeNull();
  });
});

describe('parseRawNotifications', () => {
  it('keeps valid entries and drops malformed ones', () => {
    const json = JSON.stringify([
      {
        id: 'a',
        packageName: 'com.google.android.apps.walletnfcrel',
        title: 'Shop',
        text: 'Q1.00',
        bigText: null,
        postedAt: 1,
      },
      { id: 'b', packageName: 'x' },
      'nope',
    ]);
    expect(parseRawNotifications(json)).toEqual([
      {
        id: 'a',
        packageName: 'com.google.android.apps.walletnfcrel',
        title: 'Shop',
        text: 'Q1.00',
        bigText: null,
        postedAt: 1,
      },
    ]);
    expect(parseRawNotifications('not json')).toEqual([]);
    expect(parseRawNotifications('{}')).toEqual([]);
  });
});
