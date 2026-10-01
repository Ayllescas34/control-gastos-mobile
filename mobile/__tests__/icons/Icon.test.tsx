import type { ReactTestInstance } from 'react-test-renderer';
import { Icon } from '../../src/shared/icons';
import { darkColors, lightColors } from '../../src/shared/theme/colors';
import {
  findHostElements,
  renderAsync,
} from '../../src/shared/testing/testRenderer';

const mockColorScheme = jest.fn(() => 'light');
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));

afterEach(() => mockColorScheme.mockReturnValue('light'));

/** The native SVG host element Lucide renders. */
function findSvg(root: ReactTestInstance): ReactTestInstance {
  const [svg] = findHostElements(root, 'RNSVGSvgView');
  return svg;
}

async function renderIcon(element: React.ReactElement) {
  const { root } = await renderAsync(element);
  return { root, svg: findSvg(root) };
}

describe('Icon', () => {
  it('renders the registered glyph with theme defaults', async () => {
    const { svg } = await renderIcon(<Icon name="home" />);

    expect(svg.props.width).toBe(20); // iconSize.md
    expect(svg.props.height).toBe(20);
    expect(svg.props.stroke).toBe(lightColors.textPrimary);
    expect(svg.props.strokeWidth).toBe(2);
  });

  it('resolves size tokens and accepts explicit pixels', async () => {
    expect(
      (await renderIcon(<Icon name="add" size="sm" />)).svg.props.width,
    ).toBe(16);
    expect(
      (await renderIcon(<Icon name="add" size="lg" />)).svg.props.width,
    ).toBe(24);
    expect(
      (await renderIcon(<Icon name="add" size="xl" />)).svg.props.width,
    ).toBe(32);
    expect(
      (await renderIcon(<Icon name="add" size={28} />)).svg.props.height,
    ).toBe(28);
  });

  it('applies a theme color token', async () => {
    const { svg } = await renderIcon(<Icon name="arrowDown" color="income" />);
    expect(svg.props.stroke).toBe(lightColors.income);
  });

  it('follows the dark theme', async () => {
    mockColorScheme.mockReturnValue('dark');
    const { svg } = await renderIcon(<Icon name="arrowDown" color="income" />);
    expect(svg.props.stroke).toBe(darkColors.income);
  });

  it('applies a custom strokeWidth', async () => {
    const { svg } = await renderIcon(<Icon name="chart" strokeWidth={1.5} />);
    expect(svg.props.strokeWidth).toBe(1.5);
  });

  it('applies testID and style to the rendered element', async () => {
    const style = { marginTop: 4 };
    const { svg } = await renderIcon(
      <Icon name="bell" testID="bell-icon" style={style} />,
    );
    expect(svg.props.testID).toBe('bell-icon');
    expect(svg.props.style).toEqual(expect.arrayContaining([style]));
  });

  it('is decorative by default: hidden from screen readers', async () => {
    const { root, svg } = await renderIcon(<Icon name="home" />);

    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(root.findAll(node => node.props.accessible === true)).toHaveLength(
      0,
    );
  });

  it('with accessibilityLabel, is announced once as an image', async () => {
    const { root, svg } = await renderIcon(
      <Icon name="warning" accessibilityLabel="Advertencia" testID="warn" />,
    );

    const accessible = root.findAll(
      node => typeof node.type === 'string' && node.props.accessible === true,
    );
    expect(accessible).toHaveLength(1);
    expect(accessible[0].props).toMatchObject({
      accessibilityRole: 'image',
      accessibilityLabel: 'Advertencia',
      testID: 'warn',
    });
    // The glyph itself stays hidden so it is not announced twice.
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
