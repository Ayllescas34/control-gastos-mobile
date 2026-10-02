import {
  accountToFormValues,
  EMPTY_ACCOUNT_FORM,
  parseAccountForm,
} from '../../src/features/accounts/components/accountFormModel';
import {
  cardToFormValues,
  emptyCardForm,
  parseCardForm,
} from '../../src/features/accounts/components/cardFormModel';
import type { Account, Card } from '../../src/features/accounts';

const NOW = '2026-10-01T12:00:00.000Z';

describe('parseAccountForm', () => {
  it('builds a domain input with the balance in integer minor units', () => {
    expect(
      parseAccountForm(
        { name: '  Banco  ', type: 'bank', initialBalance: '12,500.50' },
        'GTQ',
      ),
    ).toEqual({
      ok: true,
      input: {
        name: 'Banco',
        type: 'bank',
        currency: 'GTQ',
        initialBalanceMinor: 1250050,
      },
    });
  });

  it('treats an empty balance as 0', () => {
    const result = parseAccountForm(
      { name: 'Efectivo', type: 'cash', initialBalance: '' },
      'GTQ',
    );
    expect(result.ok && result.input.initialBalanceMinor).toBe(0);
  });

  it('accepts a negative balance (credit card debt)', () => {
    const result = parseAccountForm(
      { name: 'Visa', type: 'credit_card', initialBalance: '-1,500' },
      'GTQ',
    );
    expect(result.ok && result.input.initialBalanceMinor).toBe(-150000);
  });

  it('maps every broken rule to its field', () => {
    expect(parseAccountForm(EMPTY_ACCOUNT_FORM, 'GTQ')).toEqual({
      ok: false,
      errors: {
        name: 'Escribe un nombre para la cuenta.',
        type: 'Elige el tipo de cuenta.',
      },
    });
  });

  it.each([
    ['abc', 'Escribe un monto como 1500 o 1,500.50.'],
    ['10.555', 'Usa como máximo 2 decimales.'],
    ['99999999999999999', 'El monto es demasiado grande.'],
  ])('rejects the balance "%s"', (initialBalance, message) => {
    expect(
      parseAccountForm({ name: 'Banco', type: 'bank', initialBalance }, 'GTQ'),
    ).toEqual({ ok: false, errors: { initialBalance: message } });
  });

  it('prefills an edit form from an account', () => {
    const account: Account = {
      id: 'a1',
      name: 'Ahorro',
      type: 'savings',
      currency: 'GTQ',
      initialBalanceMinor: 50005,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    };
    expect(accountToFormValues(account)).toEqual({
      name: 'Ahorro',
      type: 'savings',
      initialBalance: '500.05',
    });
  });
});

describe('parseCardForm', () => {
  it('builds a domain input; "none" network becomes null', () => {
    expect(
      parseCardForm({
        alias: ' Débito ',
        last4: '0042',
        network: 'none',
        accountId: 'a1',
      }),
    ).toEqual({
      ok: true,
      input: { accountId: 'a1', alias: 'Débito', last4: '0042', network: null },
    });
  });

  it('maps broken rules to fields', () => {
    expect(parseCardForm(emptyCardForm(null))).toEqual({
      ok: false,
      errors: {
        alias: 'Escribe un nombre para identificar la tarjeta.',
        last4: 'Escribe solo los últimos 4 dígitos de la tarjeta.',
        accountId: 'Elige la cuenta de la tarjeta.',
      },
    });
  });

  it('prefills an edit form from a card', () => {
    const card: Card = {
      id: 'c1',
      accountId: 'a1',
      alias: 'Visa',
      last4: '4242',
      network: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    };
    expect(cardToFormValues(card)).toEqual({
      alias: 'Visa',
      last4: '4242',
      network: 'none',
      accountId: 'a1',
    });
  });
});
