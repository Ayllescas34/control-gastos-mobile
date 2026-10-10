import { foldSearchText } from '../../src/shared/lib/text';

describe('foldSearchText', () => {
  it('drops the accent of Spanish vowels in both cases', () => {
    expect(foldSearchText('Depósito ÁÉÍÓÚ áéíóú')).toBe(
      'Deposito aeiou aeiou',
    );
    expect(foldSearchText('Pingüino PINGÜINO')).toBe('Pinguino PINGuINO');
  });

  it('keeps ñ as a letter and only folds its case', () => {
    expect(foldSearchText('Niño NIÑO')).toBe('Niño NIñO');
    expect(foldSearchText('ano')).toBe('ano');
  });

  it('folds decomposed text like composed text', () => {
    expect(foldSearchText('Café')).toBe(foldSearchText('Café'));
    expect(foldSearchText('ñ')).toBe('ñ');
    expect(foldSearchText('Ñ')).toBe('ñ');
    expect(foldSearchText('ü')).toBe('u');
  });

  it('leaves ASCII case, digits and other symbols alone (LIKE folds ASCII case)', () => {
    expect(foldSearchText('Super 100% A_B\\')).toBe('Super 100% A_B\\');
  });
});
