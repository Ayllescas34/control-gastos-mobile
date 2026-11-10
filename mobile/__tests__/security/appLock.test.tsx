import { AppState, Text, type AppStateStatus } from 'react-native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import {
  AppLockGate,
  formatWait,
  isTrivialPin,
  newPinProblem,
  RELOCK_AFTER_MS,
} from '../../src/features/security';
import {
  flushAsync,
  hasText,
  pressByTestId,
  renderAsync,
} from '../../src/shared/testing/testRenderer';

/** In-memory stand-in for the Android module: same contract, no Keystore. */
const native = {
  pin: null as string | null,
  failures: 0,
  lockedUntil: 0,
};

jest.mock('../../src/core/native/specs/NativeAppLock', () => ({
  __esModule: true,
  default: {
    getStatus: async () =>
      JSON.stringify({
        enabled: native.pin !== null,
        lockedUntil: native.lockedUntil,
      }),
    enable: async (pin: string) => {
      native.pin = pin;
    },
    verify: async (pin: string) => {
      if (native.lockedUntil > Date.now()) {
        return JSON.stringify({ ok: false, lockedUntil: native.lockedUntil });
      }
      if (pin === native.pin) {
        native.failures = 0;
        return JSON.stringify({ ok: true, lockedUntil: 0 });
      }
      native.failures += 1;
      native.lockedUntil = native.failures >= 5 ? Date.now() + 30_000 : 0;
      return JSON.stringify({ ok: false, lockedUntil: native.lockedUntil });
    },
    change: async () => JSON.stringify({ ok: true, lockedUntil: 0 }),
    disable: async () => JSON.stringify({ ok: true, lockedUntil: 0 }),
    resetWithDeviceCredential: async (next: string) => {
      native.pin = next;
    },
  },
}));

let renderer: Renderer | null = null;
let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  native.pin = null;
  native.failures = 0;
  native.lockedUntil = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appStateListener = listener;
    return { remove: () => {} };
  });
});

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await ReactTestRenderer.act(async () => mounted.unmount());
    renderer = null;
  }
  jest.restoreAllMocks();
});

async function open(): Promise<Renderer> {
  renderer = await renderAsync(
    <AppLockGate>
      <Text>Mis finanzas</Text>
    </AppLockGate>,
  );
  await flushAsync();
  return renderer;
}

async function typePin(view: Renderer, pin: string, pad = 'unlock-pin') {
  for (const digit of pin) {
    await pressByTestId(view.root, `${pad}-key-${digit}`);
  }
  await flushAsync();
}

const locked = (view: Renderer) =>
  view.root.findAll(node => node.props.testID === 'lock-screen').length > 0;

describe('PIN rules', () => {
  it('refuses repeated digits and straight runs', () => {
    expect(isTrivialPin('111111')).toBe(true);
    expect(isTrivialPin('123456')).toBe(true);
    expect(isTrivialPin('987654')).toBe(true);
    expect(isTrivialPin('482913')).toBe(false);
    expect(isTrivialPin('135791')).toBe(false);
  });

  it('checks length, triviality and the confirmation', () => {
    expect(newPinProblem('12345', '12345')).toBe('length');
    expect(newPinProblem('000000', '000000')).toBe('trivial');
    expect(newPinProblem('482913', '482914')).toBe('mismatch');
    expect(newPinProblem('482913', '482913')).toBeNull();
  });

  it('formats the wait', () => {
    expect(formatWait(29_100)).toBe('30 s');
    expect(formatWait(120_000)).toBe('2 min');
  });
});

describe('AppLockGate', () => {
  it('opens directly without a PIN', async () => {
    const view = await open();
    expect(locked(view)).toBe(false);
    expect(hasText(view, 'Mis finanzas')).toBe(true);
  });

  it('asks for the PIN at start and unlocks with the right one', async () => {
    native.pin = '482913';
    const view = await open();
    expect(locked(view)).toBe(true);

    await typePin(view, '000001');
    expect(hasText(view, 'PIN incorrecto. Intenta de nuevo.')).toBe(true);
    expect(locked(view)).toBe(true);

    await typePin(view, '482913');
    expect(locked(view)).toBe(false);
  });

  it('makes the user wait after five wrong PINs', async () => {
    native.pin = '482913';
    const view = await open();
    for (let attempt = 0; attempt < 5; attempt++) {
      await typePin(view, '000001');
    }
    expect(hasText(view, 'Demasiados intentos. Espera 30 s.')).toBe(true);
    // The keys are disabled while waiting, even the right PIN does nothing.
    await typePin(view, '482913');
    expect(locked(view)).toBe(true);
  }, 30_000);

  it('locks again only after a minute away', async () => {
    native.pin = '482913';
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const view = await open();
    await typePin(view, '482913');
    expect(locked(view)).toBe(false);

    await ReactTestRenderer.act(async () => appStateListener?.('background'));
    now.mockReturnValue(1_000_000 + 10_000);
    await ReactTestRenderer.act(async () => appStateListener?.('active'));
    await flushAsync();
    expect(locked(view)).toBe(false);

    await ReactTestRenderer.act(async () => appStateListener?.('background'));
    now.mockReturnValue(1_000_000 + 10_000 + RELOCK_AFTER_MS);
    await ReactTestRenderer.act(async () => appStateListener?.('active'));
    await flushAsync();
    expect(locked(view)).toBe(true);
  });

  it('creates a new PIN through the phone lock when it is forgotten', async () => {
    native.pin = '482913';
    const view = await open();
    await pressByTestId(view.root, 'unlock-forgot');
    await typePin(view, '739104', 'new-pin');
    await typePin(view, '739104', 'confirm-pin');

    expect(native.pin).toBe('739104');
    expect(locked(view)).toBe(false);
  });
});
