import { CATEGORY_KINDS as SCHEMA_CATEGORY_KINDS } from '../../src/core/db';
import {
  CATEGORY_ICONS,
  CATEGORY_KINDS,
  normalizeCategoryName,
  validateCategory,
} from '../../src/features/categories';
import { iconRegistry } from '../../src/shared/icons/iconRegistry';

const valid = { name: 'Mascotas', kind: 'expense', icon: 'other' };
const noOthers = { existing: [] };

describe('validateCategory', () => {
  it('accepts a valid category', () => {
    expect(validateCategory(valid, noOthers)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it.each(['', '   '])('requires a name (%p)', name => {
    expect(validateCategory({ ...valid, name }, noOthers).errors).toEqual([
      'name_required',
    ]);
  });

  it('limits the name length', () => {
    expect(
      validateCategory({ ...valid, name: 'x'.repeat(41) }, noOthers).errors,
    ).toEqual(['name_too_long']);
  });

  it.each([null, '', 'transfer', 'EXPENSE'])('rejects kind %p', kind => {
    expect(validateCategory({ ...valid, kind }, noOthers).errors).toEqual([
      'kind_invalid',
    ]);
  });

  it.each([null, '', 'rocket', 'Restaurant'])('rejects icon %p', icon => {
    expect(validateCategory({ ...valid, icon }, noOthers).errors).toEqual([
      'icon_invalid',
    ]);
  });

  it('rejects a duplicate name of the same kind, ignoring case, accents and spaces', () => {
    const context = {
      existing: [{ id: 'c1', name: 'Café', kind: 'expense' as const }],
    };
    for (const name of ['Café', 'cafe', ' CAFÉ ', 'cafe']) {
      expect(validateCategory({ ...valid, name }, context).errors).toEqual([
        'name_duplicate',
      ]);
    }
  });

  it('allows the same name for the other kind', () => {
    const context = {
      existing: [{ id: 'c1', name: 'Otros', kind: 'expense' as const }],
    };
    expect(
      validateCategory({ ...valid, name: 'Otros', kind: 'income' }, context)
        .valid,
    ).toBe(true);
  });

  it('lets a category keep its own name when editing', () => {
    const context = {
      existing: [{ id: 'c1', name: 'Café', kind: 'expense' as const }],
      currentId: 'c1',
    };
    expect(validateCategory({ ...valid, name: 'café' }, context).valid).toBe(
      true,
    );
  });
});

describe('normalizeCategoryName', () => {
  it('folds case, accents, ñ marks and spacing', () => {
    expect(normalizeCategoryName('  Educación   Básica ')).toBe(
      'educacion basica',
    );
    expect(normalizeCategoryName('AÑO')).toBe('ano');
  });
});

describe('category value lists', () => {
  it('every category icon exists in the icon system', () => {
    for (const icon of CATEGORY_ICONS) {
      expect(Object.keys(iconRegistry)).toContain(icon);
    }
  });

  it('kinds match the SQLite schema', () => {
    expect([...CATEGORY_KINDS]).toEqual([...SCHEMA_CATEGORY_KINDS]);
  });
});
