import {
  ACCOUNT_TYPES as SCHEMA_ACCOUNT_TYPES,
  CARD_NETWORKS as SCHEMA_CARD_NETWORKS,
} from '../../src/core/db';
import {
  ACCOUNT_TYPES,
  CARD_NETWORKS,
  validateAccount,
  validateCard,
} from '../../src/features/accounts';

const validAccount = {
  name: 'Banco Industrial',
  type: 'bank',
  currency: 'GTQ',
  initialBalanceMinor: 150000,
};

const validCard = {
  accountId: 'account-1',
  alias: 'Visa personal',
  last4: '4242',
  network: 'visa' as const,
};

describe('validateAccount', () => {
  it('accepts a valid account, including a negative (debt) initial balance', () => {
    expect(validateAccount(validAccount)).toEqual({ valid: true, errors: [] });
    expect(
      validateAccount({
        ...validAccount,
        type: 'credit_card',
        initialBalanceMinor: -50000,
      }).valid,
    ).toBe(true);
  });

  it.each(['', '   '])('requires a name (%p)', name => {
    expect(validateAccount({ ...validAccount, name }).errors).toEqual([
      'name_required',
    ]);
  });

  it('limits the name length', () => {
    expect(
      validateAccount({ ...validAccount, name: 'x'.repeat(61) }).errors,
    ).toEqual(['name_too_long']);
    expect(
      validateAccount({ ...validAccount, name: 'x'.repeat(60) }).valid,
    ).toBe(true);
  });

  it.each([null, '', 'crypto', 'BANK'])('rejects type %p', type => {
    expect(validateAccount({ ...validAccount, type }).errors).toEqual([
      'type_invalid',
    ]);
  });

  it.each(['', 'gtq', 'GT', 'GTQX', '123'])('rejects currency %p', currency => {
    expect(validateAccount({ ...validAccount, currency }).errors).toEqual([
      'currency_invalid',
    ]);
  });

  it.each([10.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    'rejects a non-integer or unsafe initial balance (%p)',
    initialBalanceMinor => {
      expect(
        validateAccount({ ...validAccount, initialBalanceMinor }).errors,
      ).toEqual(['initial_balance_invalid']);
    },
  );

  it('reports every broken rule at once', () => {
    expect(
      validateAccount({
        name: '',
        type: null,
        currency: 'x',
        initialBalanceMinor: 0.5,
      }).errors,
    ).toEqual([
      'name_required',
      'type_invalid',
      'currency_invalid',
      'initial_balance_invalid',
    ]);
  });
});

describe('validateCard', () => {
  const context = { account: { id: 'account-1' } };

  it('accepts a valid card, with or without network', () => {
    expect(validateCard(validCard, context)).toEqual({
      valid: true,
      errors: [],
    });
    expect(validateCard({ ...validCard, network: null }, context).valid).toBe(
      true,
    );
  });

  it.each(['', '  '])('requires an alias (%p)', alias => {
    expect(validateCard({ ...validCard, alias }, context).errors).toEqual([
      'alias_required',
    ]);
  });

  it.each(['123', '12345', 'abcd', '12a4', '4111111111111111', ' 1234'])(
    'rejects last4 %p (never a full card number)',
    last4 => {
      expect(validateCard({ ...validCard, last4 }, context).errors).toEqual([
        'last4_invalid',
      ]);
    },
  );

  it('keeps leading zeros in last4', () => {
    expect(validateCard({ ...validCard, last4: '0007' }, context).valid).toBe(
      true,
    );
  });

  it('rejects an unknown network', () => {
    expect(
      validateCard(
        { ...validCard, network: 'diners' as typeof validCard.network },
        context,
      ).errors,
    ).toEqual(['network_invalid']);
  });

  it('requires an account', () => {
    expect(
      validateCard({ ...validCard, accountId: '' }, { account: null }).errors,
    ).toEqual(['account_required']);
  });

  it('requires the account to exist and be active', () => {
    expect(validateCard(validCard, { account: null }).errors).toEqual([
      'account_not_found',
    ]);
    expect(
      validateCard(validCard, { account: { id: 'other' } }).errors,
    ).toEqual(['account_not_found']);
  });

  it('allows any account type: credit vs debit follows the account', () => {
    // The validation context only needs the account to exist; its type is not restricted.
    expect(
      validateCard(validCard, { account: { id: 'account-1' } }).valid,
    ).toBe(true);
  });
});

describe('domain value lists', () => {
  it('match the SQLite schema CHECK constraints', () => {
    expect([...ACCOUNT_TYPES]).toEqual([...SCHEMA_ACCOUNT_TYPES]);
    expect([...CARD_NETWORKS]).toEqual([...SCHEMA_CARD_NETWORKS]);
  });
});
