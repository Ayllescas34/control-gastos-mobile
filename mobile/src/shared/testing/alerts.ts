import { Alert, type AlertButton } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { flushAsync } from './testRenderer';

/** Tests only: captures Alert.alert calls instead of opening native dialogs. */
export function spyOnAlerts() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const lastButtons = (): AlertButton[] =>
    (alert.mock.calls.at(-1)?.[2] as AlertButton[] | undefined) ?? [];
  return { alert, lastButtons };
}

/** Taps the alert button labelled `text` (a cancel button may have no handler). */
export async function chooseAlertButton(
  buttons: AlertButton[],
  text: string,
): Promise<void> {
  const button = buttons.find(candidate => candidate.text === text);
  if (!button) {
    throw new Error(`No "${text}" button`);
  }
  await ReactTestRenderer.act(async () => {
    button.onPress?.();
  });
  await flushAsync();
}
