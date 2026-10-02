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

/**
 * Lets pending promises (e.g. real SQLite reads and writes) resolve and React apply the
 * resulting updates. Several macrotask turns cover chained awaits.
 */
export async function flushAsync(turns = 10): Promise<void> {
  await ReactTestRenderer.act(async () => {
    for (let i = 0; i < turns; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  });
}

function findInteractive(
  root: ReactTestInstance,
  testID: string,
  handler: 'onPress' | 'onChangeText',
): ReactTestInstance {
  const [node] = root.findAll(
    candidate =>
      candidate.props.testID === testID &&
      typeof candidate.props[handler] === 'function',
  );
  if (!node) {
    throw new Error(`No element with testID "${testID}" handles ${handler}`);
  }
  return node;
}

/** Presses the element with `testID` (as a user tap would) and waits for the effects. */
export async function pressByTestId(
  root: ReactTestInstance,
  testID: string,
): Promise<void> {
  const node = findInteractive(root, testID, 'onPress');
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
  await flushAsync();
}

/**
 * Whether an element with `testID` can currently be pressed: it handles presses and no
 * layer of it (wrapper or Pressable) is disabled.
 */
export function canPress(root: ReactTestInstance, testID: string): boolean {
  const nodes = root.findAll(candidate => candidate.props.testID === testID);
  const disabled = nodes.some(
    node =>
      node.props.disabled === true ||
      node.props.accessibilityState?.disabled === true,
  );
  return (
    !disabled && nodes.some(node => typeof node.props.onPress === 'function')
  );
}

/** Types into the text input with `testID`. */
export async function typeByTestId(
  root: ReactTestInstance,
  testID: string,
  text: string,
): Promise<void> {
  const node = findInteractive(root, testID, 'onChangeText');
  await ReactTestRenderer.act(async () => {
    node.props.onChangeText(text);
  });
}

/** The current value of the text input with `testID`. */
export function inputValue(root: ReactTestInstance, testID: string): string {
  return findInteractive(root, testID, 'onChangeText').props.value;
}

/** Whether `text` is rendered anywhere in the tree. */
export function hasText(renderer: Renderer, text: string): boolean {
  return JSON.stringify(renderer.toJSON()).includes(text);
}
