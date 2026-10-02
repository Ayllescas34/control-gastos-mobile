import { Icon, type IconName } from '../../src/shared/icons';
import { iconRegistry } from '../../src/shared/icons/iconRegistry';
import { renderAsync } from '../../src/shared/testing/testRenderer';

/** The app's icon contract. "home" serves both navigation and the housing category. */
const EXPECTED_ICON_NAMES: readonly IconName[] = [
  // Navigation
  'home',
  'transactions',
  'reports',
  'settings',
  'menu',
  // Actions
  'add',
  'close',
  'back',
  'forward',
  'search',
  'filter',
  'edit',
  'delete',
  'check',
  'more',
  'chevronRight',
  'chevronDown',
  // Finance
  'wallet',
  'bank',
  'creditCard',
  'cash',
  'arrowUp',
  'arrowDown',
  'arrowLeftRight',
  'receipt',
  'chart',
  'calendar',
  'category',
  // Categories
  'shoppingCart',
  'restaurant',
  'car',
  'health',
  'education',
  'entertainment',
  'coffee',
  'shoppingBag',
  'utilities',
  'subscription',
  'travel',
  'salary',
  'other',
  // System
  'bell',
  'user',
  'info',
  'warning',
  'error',
  'success',
];

const registeredNames = Object.keys(iconRegistry) as IconName[];

describe('iconRegistry', () => {
  it('contains exactly the expected icon names', () => {
    expect([...registeredNames].sort()).toEqual(
      [...EXPECTED_ICON_NAMES].sort(),
    );
  });

  it('maps every name to a different glyph', () => {
    const glyphs = Object.values(iconRegistry);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('cannot be modified at runtime', () => {
    expect(Object.isFrozen(iconRegistry)).toBe(true);
  });

  it.each(registeredNames)('"%s" renders a non-empty SVG glyph', async name => {
    const tree = (await renderAsync(<Icon name={name} />)).toJSON();

    expect(tree).not.toBeNull();
    expect(Array.isArray(tree)).toBe(false);
    if (tree && !Array.isArray(tree)) {
      expect(tree.type).toBe('RNSVGSvgView');
      expect(tree.children?.length).toBeGreaterThan(0);
    }
  });
});
