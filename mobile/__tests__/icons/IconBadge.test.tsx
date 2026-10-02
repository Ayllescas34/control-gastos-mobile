import { IconBadge, type IconTone } from '../../src/shared/icons';
import { darkColors, lightColors } from '../../src/shared/theme/colors';
import { withAlpha } from '../../src/shared/theme';
import {
  findHostElements,
  flatViewStyle,
  renderAsync,
} from '../../src/shared/testing/testRenderer';

const mockColorScheme = jest.fn(() => 'light');
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));

afterEach(() => mockColorScheme.mockReturnValue('light'));

async function renderBadge(element: React.ReactElement) {
  const { root } = await renderAsync(element);
  const [container] = root.findAll(
    node => typeof node.type === 'string' && node.props.testID === 'badge',
  );
  const [svg] = findHostElements(root, 'RNSVGSvgView');
  return { root, svg, style: flatViewStyle(container.props.style) };
}

describe('IconBadge', () => {
  it('renders neutral by default with muted surface and secondary text', async () => {
    const { svg, style } = await renderBadge(
      <IconBadge name="wallet" testID="badge" />,
    );

    expect(style.backgroundColor).toBe(lightColors.surfaceMuted);
    expect(svg.props.stroke).toBe(lightColors.textSecondary);
    expect(style.width).toBe(40);
    expect(svg.props.width).toBe(20);
  });

  it.each<[IconTone, keyof typeof lightColors]>([
    ['primary', 'primary'],
    ['income', 'income'],
    ['expense', 'expense'],
    ['transfer', 'transfer'],
    ['warning', 'warning'],
    ['error', 'error'],
  ])(
    'variant %s tints its background from the %s token',
    async (variant, token) => {
      const { svg, style } = await renderBadge(
        <IconBadge name="chart" variant={variant} testID="badge" />,
      );

      expect(svg.props.stroke).toBe(lightColors[token]);
      expect(style.backgroundColor).toBe(withAlpha(lightColors[token], 0.12));
    },
  );

  it('uses a stronger tint on dark surfaces', async () => {
    mockColorScheme.mockReturnValue('dark');
    const { svg, style } = await renderBadge(
      <IconBadge name="arrowUp" variant="expense" testID="badge" />,
    );

    expect(svg.props.stroke).toBe(darkColors.expense);
    expect(style.backgroundColor).toBe(withAlpha(darkColors.expense, 0.2));
  });

  it.each([
    ['sm', 32, 16],
    ['md', 40, 20],
    ['lg', 48, 24],
  ] as const)(
    'size %s: %ipx container, %ipx glyph',
    async (size, box, glyph) => {
      const { svg, style } = await renderBadge(
        <IconBadge name="bank" size={size} testID="badge" />,
      );

      expect(style).toMatchObject({ width: box, height: box });
      expect(svg.props.width).toBe(glyph);
    },
  );

  it('is decorative unless labelled', async () => {
    const decorative = await renderBadge(
      <IconBadge name="car" testID="badge" />,
    );
    expect(
      decorative.root.findAll(node => node.props.accessible === true),
    ).toHaveLength(0);

    const labelled = await renderBadge(
      <IconBadge name="car" accessibilityLabel="Transporte" testID="badge" />,
    );
    expect(
      labelled.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.accessibilityLabel === 'Transporte',
      ),
    ).toHaveLength(1);
  });
});
