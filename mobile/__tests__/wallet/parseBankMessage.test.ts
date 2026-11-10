import {
  matchAccountByLabel,
  parseBankDate,
  parseBankMessage,
} from '../../src/features/wallet/domain/parseBankMessage';

// Received on 9 Nov 2026, local time.
const RECEIVED = new Date(2026, 10, 9, 21, 55);
const at = (month: number, day: number, hour: number, minute: number) =>
  new Date(2026, month, day, hour, minute);

describe('parseBankMessage with real Banco Industrial (BiMovil) SMS', () => {
  it('reads a purchase on the monetary account', () => {
    expect(
      parseBankMessage(
        'BiMovil: Consumo por Q.28.25 en SUPER LA TORRE JOCOTEN Cuenta BICHEQUE3 24-Oct 13:29 Autorizacion 168554.',
        RECEIVED,
      ),
    ).toEqual({
      kind: 'expense',
      amountMinor: 2825,
      currency: 'GTQ',
      merchant: 'SUPER LA TORRE JOCOTEN',
      accountLabel: 'BICHEQUE3',
      reference: '168554',
      occurredAt: at(9, 24, 13, 29),
    });
  });

  it('reads a credit card purchase', () => {
    expect(
      parseBankMessage(
        'BiMovil: Consumo por Q.250.00 en TB83 PLAZA JOCOTENANGO Cuenta TCREDITO 07-Nov 14:38 Autorizacion 181742.',
        RECEIVED,
      ),
    ).toMatchObject({
      kind: 'expense',
      amountMinor: 25000,
      merchant: 'TB83 PLAZA JOCOTENANGO',
      accountLabel: 'TCREDITO',
      reference: '181742',
      occurredAt: at(10, 7, 14, 38),
    });
  });

  it('reads a deposit as income, with "Q. " and two spaces', () => {
    expect(
      parseBankMessage(
        'BiMovil: Credito por  Q. 80.00 Cuenta AHORRO en la Agencia DIGITAL  25-Oct 09:53 Autorizacion 24146016.',
        RECEIVED,
      ),
    ).toEqual({
      kind: 'income',
      amountMinor: 8000,
      currency: 'GTQ',
      merchant: 'Agencia DIGITAL',
      accountLabel: 'AHORRO',
      reference: '24146016',
      occurredAt: at(9, 25, 9, 53),
    });
  });

  it('reads an ATM withdrawal and its short authorization', () => {
    expect(
      parseBankMessage(
        'BiMovil: Retiro por Q.100.00 en el Cajero A-AG JOCOTENANGO con su tarjeta BICHEQUE3 07-Nov 15:26 Aut.174582.',
        RECEIVED,
      ),
    ).toEqual({
      kind: 'withdrawal',
      amountMinor: 10000,
      currency: 'GTQ',
      merchant: 'Cajero A-AG JOCOTENANGO',
      accountLabel: 'BICHEQUE3',
      reference: '174582',
      occurredAt: at(10, 7, 15, 26),
    });
  });

  it('reads a debit', () => {
    expect(
      parseBankMessage(
        'BiMovil: Debito por Q.100.00 Cuenta AHORRO en la Agencia CAJEROS AUTOMATICOS 07-Nov 15:26 Autorizacion 7349.',
        RECEIVED,
      ),
    ).toMatchObject({
      kind: 'expense',
      merchant: 'Agencia CAJEROS AUTOMATICOS',
      accountLabel: 'AHORRO',
      reference: '7349',
    });
  });
});

describe('parseBankMessage with other wording', () => {
  it('lets the first operation word decide', () => {
    expect(
      parseBankMessage(
        'Banco X: Compra con tarjeta de crédito ****1234 por Q1,250.50 en AMAZON',
        RECEIVED,
      ),
    ).toMatchObject({
      kind: 'expense',
      amountMinor: 125050,
      accountLabel: '****1234',
      occurredAt: null,
    });
    expect(
      parseBankMessage('Deposito recibido por US$20.00 en cuenta 5678', RECEIVED),
    ).toMatchObject({ kind: 'income', currency: 'USD', amountMinor: 2000 });
  });

  it('ignores codes, declined operations and texts without an amount', () => {
    expect(
      parseBankMessage('BiMovil: Tu codigo de seguridad es 482910', RECEIVED),
    ).toBeNull();
    expect(
      parseBankMessage(
        'BiMovil: Consumo por Q.50.00 rechazado por fondos insuficientes',
        RECEIVED,
      ),
    ).toBeNull();
    expect(parseBankMessage('Hola, ¿cómo estás?', RECEIVED)).toBeNull();
    expect(parseBankMessage('BiMovil: Consumo registrado', RECEIVED)).toBeNull();
  });
});

describe('parseBankDate', () => {
  it('puts a December movement reported in January in the previous year', () => {
    expect(
      parseBankDate('Consumo 31-Dic 23:50', new Date(2027, 0, 1, 0, 5)),
    ).toEqual(new Date(2026, 11, 31, 23, 50));
  });

  it('rejects impossible dates', () => {
    expect(parseBankDate('30-Feb 10:00', RECEIVED)).toBeNull();
    expect(parseBankDate('10-Xyz 10:00', RECEIVED)).toBeNull();
  });
});

describe('matchAccountByLabel', () => {
  const credit = { id: 'credit', labels: ['TCREDITO'] };
  const monetary = { id: 'monetary', labels: ['BICHEQUE3', '****1234'] };
  const accounts = [credit, monetary];

  it('uses the account name the bank wrote', () => {
    expect(
      matchAccountByLabel('… Cuenta TCREDITO …', 'TCREDITO', accounts),
    ).toBe(credit);
    expect(
      matchAccountByLabel('… con su tarjeta bicheque3 …', 'bicheque3', accounts),
    ).toBe(monetary);
  });

  it('falls back to any identifier mentioned as a whole word', () => {
    expect(
      matchAccountByLabel('Compra con tarjeta ****1234 por Q10', null, accounts),
    ).toBe(monetary);
    expect(
      matchAccountByLabel('Consumo en TCREDITOS DEL SUR', null, accounts),
    ).toBeNull();
  });

  it('returns null when nothing or several accounts match', () => {
    expect(matchAccountByLabel('Cuenta AHORRO', 'AHORRO', accounts)).toBeNull();
    expect(
      matchAccountByLabel('TCREDITO y BICHEQUE3', null, accounts),
    ).toBeNull();
  });
});
