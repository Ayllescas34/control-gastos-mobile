import type { ReactElement } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import ReactTestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';

/** Tests only: renders inside act() so effects settle before assertions. */
export async function renderAsync(element: ReactElement): Promise<Renderer> {
  let renderer!: Renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
}

/**
 * Native host elements by component name (e.g. "RNSVGSvgView"). Host names are plain
 * strings that React's ElementType does not list, hence the widened comparison.
 */
export function findHostElements(
  root: ReactTestInstance,
  hostType: string,
): ReactTestInstance[] {
  return root.findAll(node => (node.type as unknown) === hostType);
}

/** The flattened view style of a rendered element (empty when it has none). */
export function flatViewStyle(style: StyleProp<ViewStyle>): ViewStyle {
  return StyleSheet.flatten(style) ?? {};
}
