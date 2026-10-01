import { withAlpha } from '../../src/shared/theme';

describe('withAlpha', () => {
  it('appends the alpha channel to a #RRGGBB color', () => {
    expect(withAlpha('#2563EB', 0.12)).toBe('#2563EB1F');
    expect(withAlpha('#2563EB', 0.2)).toBe('#2563EB33');
    expect(withAlpha('#000000', 1)).toBe('#000000FF');
    expect(withAlpha('#000000', 0)).toBe('#00000000');
  });

  it('clamps alpha to [0, 1]', () => {
    expect(withAlpha('#FFFFFF', 2)).toBe('#FFFFFFFF');
    expect(withAlpha('#FFFFFF', -1)).toBe('#FFFFFF00');
  });

  it('rejects colors that are not #RRGGBB', () => {
    expect(() => withAlpha('#FFF', 0.5)).toThrow('#RRGGBB');
    expect(() => withAlpha('rgb(0, 0, 0)', 0.5)).toThrow('#RRGGBB');
    expect(() => withAlpha('#2563EB80', 0.5)).toThrow('#RRGGBB');
  });
});
