import type {
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { IconButton, type IconButtonProps } from '../../src/shared/icons';
import { lightColors } from '../../src/shared/theme/colors';
import {
  findHostElements,
  flatViewStyle,
  renderAsync,
} from '../../src/shared/testing/testRenderer';

async function renderButton(props: Partial<IconButtonProps> = {}) {
  const onPress = props.onPress ?? jest.fn();
  const { root } = await renderAsync(
    <IconButton
      icon="search"
      accessibilityLabel="Buscar"
      testID="button"
      {...props}
      onPress={onPress}
    />,
  );
  // The Pressable element: the only one receiving the style callback.
  const [pressable] = root.findAll(
    node =>
      node.props.testID === 'button' && typeof node.props.style === 'function',
  );
  const [svg] = findHostElements(root, 'RNSVGSvgView');
  return { root, pressable, svg, onPress };
}

/** Resolves Pressable's style callback for a given pressed state. */
function styleWhen(pressable: ReactTestInstance, pressed: boolean) {
  const style = pressable.props.style as (
    state: PressableStateCallbackType,
  ) => StyleProp<ViewStyle>;
  return flatViewStyle(style({ pressed }));
}

describe('IconButton', () => {
  it('renders an accessible button with label and hint', async () => {
    const { pressable } = await renderButton({
      accessibilityHint: 'Busca movimientos',
    });

    expect(pressable.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Buscar',
      accessibilityHint: 'Busca movimientos',
      accessibilityState: { disabled: false },
      testID: 'button',
    });
  });

  it('calls onPress', async () => {
    const { pressable, onPress } = await renderButton();
    pressable.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('respects disabled: no handler, disabled state and dimmed', async () => {
    const { pressable, onPress } = await renderButton({ disabled: true });

    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.onPress).toBeUndefined();
    expect(pressable.props.accessibilityState).toEqual({ disabled: true });
    expect(styleWhen(pressable, false).opacity).toBe(0.4);
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['sm', 32, 8],
    ['md', 40, 4],
  ] as const)(
    'size %s (%ipx) extends its touch target to 48px',
    async (size, box, slop) => {
      const { pressable } = await renderButton({ size });

      expect(styleWhen(pressable, false)).toMatchObject({
        width: box,
        height: box,
      });
      expect(pressable.props.hitSlop).toEqual({
        top: slop,
        bottom: slop,
        left: slop,
        right: slop,
      });
    },
  );

  it('size lg already meets the touch target', async () => {
    const { pressable } = await renderButton({ size: 'lg' });
    expect(styleWhen(pressable, false).width).toBe(48);
    expect(pressable.props.hitSlop).toBeUndefined();
  });

  it('ghost: transparent, highlighted while pressed', async () => {
    const { pressable, svg } = await renderButton({ variant: 'ghost' });

    expect(svg.props.stroke).toBe(lightColors.textPrimary);
    expect(styleWhen(pressable, false).backgroundColor).toBe('transparent');
    expect(styleWhen(pressable, true).backgroundColor).toBe(
      lightColors.surfaceMuted,
    );
  });

  it('filled: primary background, contrasting icon, dims while pressed', async () => {
    const { pressable, svg } = await renderButton({ variant: 'filled' });

    expect(svg.props.stroke).toBe(lightColors.onPrimary);
    expect(styleWhen(pressable, false)).toMatchObject({
      backgroundColor: lightColors.primary,
      opacity: 1,
    });
    expect(styleWhen(pressable, true).opacity).toBe(0.85);
  });

  it('tonal: primary icon over a primary tint', async () => {
    const { pressable, svg } = await renderButton({ variant: 'tonal' });

    expect(svg.props.stroke).toBe(lightColors.primary);
    expect(styleWhen(pressable, false).backgroundColor).toBe('#2563EB1F');
    expect(styleWhen(pressable, true).backgroundColor).toBe('#2563EB33');
  });

  it('keeps the glyph hidden: the button label is what is announced', async () => {
    const { svg } = await renderButton();
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
