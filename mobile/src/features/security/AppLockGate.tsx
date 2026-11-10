import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  getAppLockStatus,
  isAppLockSupported,
} from '../../core/native/appLock';
import { useAppTheme } from '../../shared/theme';
import { LockScreen } from './components/LockScreen';

/** Back after this long outside the app: the PIN is asked again. */
export const RELOCK_AFTER_MS = 60_000;

type AppLockContextValue = {
  supported: boolean;
  enabled: boolean;
  /** Re-reads the status after enabling, changing or disabling the PIN. */
  refresh: () => Promise<void>;
};

const AppLockContext = createContext<AppLockContextValue>({
  supported: false,
  enabled: false,
  refresh: async () => {},
});

export function useAppLock(): AppLockContextValue {
  return useContext(AppLockContext);
}

type GateState =
  | { phase: 'checking' }
  | { phase: 'open' }
  | { phase: 'locked'; lockedUntil: number };

/**
 * Asks for the PIN when the app starts and when it comes back after RELOCK_AFTER_MS in the
 * background (docs/security.md). The app stays mounted underneath, so navigation and
 * unsaved forms survive; while locked it is hidden from screen readers and covered.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const supported = isAppLockSupported();
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<GateState>(
    supported ? { phase: 'checking' } : { phase: 'open' },
  );
  const leftAt = useRef<number | null>(null);

  const readStatus = useCallback(async () => {
    try {
      return await getAppLockStatus();
    } catch {
      // Fail closed: if the status cannot be read, ask for the PIN ("Olvidé mi PIN" still
      // works through the phone's own lock).
      return { enabled: true, lockedUntil: 0 };
    }
  }, []);

  useEffect(() => {
    if (!supported) {
      return;
    }
    let active = true;
    readStatus().then(status => {
      if (!active) {
        return;
      }
      setEnabled(status.enabled);
      setState(
        status.enabled
          ? { phase: 'locked', lockedUntil: status.lockedUntil }
          : { phase: 'open' },
      );
    });
    return () => {
      active = false;
    };
  }, [supported, readStatus]);

  useEffect(() => {
    if (!supported || !enabled) {
      return;
    }
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background') {
        leftAt.current = Date.now();
      } else if (next === 'active' && leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away >= RELOCK_AFTER_MS) {
          readStatus().then(status =>
            setState(current =>
              current.phase === 'locked'
                ? current
                : { phase: 'locked', lockedUntil: status.lockedUntil },
            ),
          );
        }
      }
    });
    return () => subscription.remove();
  }, [supported, enabled, readStatus]);

  const refresh = useCallback(async () => {
    const status = await readStatus();
    setEnabled(status.enabled);
  }, [readStatus]);

  const value = useMemo(
    () => ({ supported, enabled, refresh }),
    [supported, enabled, refresh],
  );
  const covered = state.phase !== 'open';

  return (
    <AppLockContext.Provider value={value}>
      <View
        style={styles.fill}
        importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={covered}
      >
        {children}
      </View>
      {state.phase === 'checking' && (
        <View
          style={[styles.cover, { backgroundColor: theme.colors.background }]}
        />
      )}
      {state.phase === 'locked' && (
        <LockScreen
          initialLockedUntil={state.lockedUntil}
          onUnlocked={() => setState({ phase: 'open' })}
        />
      )}
    </AppLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  cover: {
    ...StyleSheet.absoluteFill,
  },
});
