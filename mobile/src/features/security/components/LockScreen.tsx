import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppLockError,
  resetPinWithDeviceCredential,
  verifyPin,
} from '../../../core/native/appLock';
import { Button } from '../../../shared/components';
import { layout, useAppTheme } from '../../../shared/theme';
import { formatWait } from '../domain/pinRules';
import { NewPinFlow } from './NewPinFlow';
import { PinPad } from './PinPad';

type LockScreenProps = {
  /** Wait already pending when the screen appears (epoch ms, 0 for none). */
  initialLockedUntil: number;
  onUnlocked: () => void;
};

const RESET_ERRORS: Partial<Record<AppLockError['code'], string>> = {
  no_device_lock:
    'Tu teléfono no tiene bloqueo de pantalla, así que no puede confirmar que eres tú.',
  cancelled: 'No se confirmó tu identidad. Tu PIN sigue igual.',
};

/** Covers the app until the PIN is right. Waits after repeated failures are native. */
export function LockScreen({ initialLockedUntil, onUnlocked }: LockScreenProps) {
  const theme = useAppTheme();
  const [lockedUntil, setLockedUntil] = useState(initialLockedUntil);
  const [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const waiting = lockedUntil > now;
  useEffect(() => {
    if (!waiting) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  async function check(pin: string) {
    setChecking(true);
    try {
      const result = await verifyPin(pin);
      if (result.ok) {
        onUnlocked();
        return;
      }
      setLockedUntil(result.lockedUntil);
      setNow(Date.now());
      setError(
        result.lockedUntil > Date.now() ? null : 'PIN incorrecto. Intenta de nuevo.',
      );
    } catch {
      setError('No se pudo comprobar el PIN. Intenta de nuevo.');
    } finally {
      setChecking(false);
    }
  }

  async function reset(next: string) {
    setChecking(true);
    try {
      await resetPinWithDeviceCredential(next);
      onUnlocked();
    } catch (failure) {
      setError(
        (failure instanceof AppLockError && RESET_ERRORS[failure.code]) ||
          'No se pudo cambiar el PIN.',
      );
      setResetting(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <View
      testID="lock-screen"
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {resetting ? (
        <NewPinFlow
          title="Crea un PIN nuevo"
          disabled={checking}
          error={error}
          onPin={reset}
        >
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => {
              setError(null);
              setResetting(false);
            }}
          />
        </NewPinFlow>
      ) : (
        <PinPad
          testID="unlock-pin"
          title="Ingresa tu PIN"
          message="Control de Gastos está bloqueado."
          disabled={checking || waiting}
          error={
            waiting
              ? `Demasiados intentos. Espera ${formatWait(lockedUntil - now)}.`
              : error
          }
          onComplete={check}
        >
          <Button
            testID="unlock-forgot"
            title="Olvidé mi PIN"
            variant="secondary"
            accessibilityHint="Usa el bloqueo de tu teléfono para crear un PIN nuevo"
            onPress={() => {
              setError(null);
              setResetting(true);
            }}
          />
        </PinPad>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingVertical: layout.screenPadding,
  },
});
