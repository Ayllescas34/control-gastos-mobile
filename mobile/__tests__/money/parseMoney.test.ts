import {
  formatMoneyInput,
  minorUnitDigits,
  parseMoney,
} from '../../src/shared/lib/money';

describe('parseMoney', () => {
  it.each([
    ['1500', 150000],
    ['1500.5', 150050],
    ['1500.50', 150050],
    ['12,500.50', 1250050],
    ['1,234,567.89', 123456789],
    ['0.01', 1],
    ['0', 0],
    ['12.', 1200],
    ['-1500', -150000],
    ['-0.50', -50],
    ['  250  ', 25000],
  ])('parses "%s" into %i minor units', (input, expected) => {
    expect(parseMoney(input, 'GTQ')).toEqual({
      ok: true,
      amountMinor: expected,
    });
  });

  it('is exact where floating point is not (0.1 + 0.2, 1.15, 4.35)', () => {
    expect(parseMoney('0.30', 'GTQ')).toEqual({ ok: true, amountMinor: 30 });
    expect(parseMoney('1.15', 'GTQ')).toEqual({ ok: true, amountMinor: 115 });
    expect(parseMoney('4.35', 'GTQ')).toEqual({ ok: true, amountMinor: 435 });
  });

  it('never returns -0', () => {
    const result = parseMoney('-0.00', 'GTQ');
    expect(result).toEqual({ ok: true, amountMinor: 0 });
    expect(Object.is(result.ok && result.amountMinor, -0)).toBe(false);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'invalid'],
    ['12a', 'invalid'],
    ['1.2.3', 'invalid'],
    ['12,50', 'invalid'],
    ['1,2345', 'invalid'],
    ['+100', 'invalid'],
    ['1e5', 'invalid'],
    ['Q100', 'invalid'],
    ['10.555', 'too_many_decimals'],
    ['99999999999999999', 'too_large'],
  ])('rejects "%s" as %s', (input, error) => {
    expect(parseMoney(input, 'GTQ')).toEqual({ ok: false, error });
  });

  it('accepts the largest exact amount (2^53 - 1 minor units)', () => {
    expect(parseMoney('90071992547409.91', 'GTQ')).toEqual({
      ok: true,
      amountMinor: Number.MAX_SAFE_INTEGER,
    });
  });
});

describe('formatMoneyInput', () => {
  it.each([
    [1250050, '12500.50'],
    [150000, '1500.00'],
    [5, '0.05'],
    [0, '0.00'],
    [-150000, '-1500.00'],
  ])('formats %i as "%s"', (amountMinor, expected) => {
    expect(formatMoneyInput(amountMinor, 'GTQ')).toBe(expected);
  });

  it('round-trips with parseMoney', () => {
    for (const amount of [
      0,
      1,
      99,
      100,
      123456789,
      -42,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(parseMoney(formatMoneyInput(amount, 'GTQ'), 'GTQ')).toEqual({
        ok: true,
        amountMinor: amount,
      });
    }
  });
});

describe('minorUnitDigits', () => {
  it('uses 2 decimals for GTQ and as the default', () => {
    expect(minorUnitDigits('GTQ')).toBe(2);
    expect(minorUnitDigits('XYZ')).toBe(2);
  });
});
