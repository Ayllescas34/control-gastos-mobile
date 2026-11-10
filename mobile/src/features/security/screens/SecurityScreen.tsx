import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  changePin,
  disablePin,
  enablePin,
} from '../../../core/native/appLock';
import {
  AppText,
  Button,
  Card,
  DetailRow,
  Screen,
} from '../../../shared/components';
import { spacing } from '../../../shared/theme';
import { useAppLock } from '../AppLockGate';
import { NewPinFlow } from '../components/NewPinFlow';
import { PinPad } from '../components/PinPad';
import { formatWait } from '../domain/pinRules';

type Mode =
  | { kind: 'menu' }
  | { kind: 'create' }
  | { kind: 'change-current' }
  | { kind: 'change-new'; current: string }
  | { kind: 'disable' };

/** Configuración → Seguridad: turn the 6-digit PIN on, change it or turn it off. */
export function SecurityScreen() {
  const { supported, enabled, refresh } = useAppLock();
  const [mode, setMode] = useState<Mode>({ kind: 'menu' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function back(message: string | null = null) {
    setError(null);
    setNotice(message);
    setMode({ kind: 'menu' });
  }

  async function run(work: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    try {
      const message = await work();
      await refresh();
      if (message !== null) {
        back(message);
      }
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  /** Wrong current PIN: say so, with the wait when there is one. */
  const rejected = (lockedUntil: number) =>
    lockedUntil > Date.now()
      ? `Demasiados intentos. Espera ${formatWait(lockedUntil - Date.now())}.`
      : 'PIN actual incorrecto.';

  const cancel = (
    <Button title="Cancelar" variant="secondary" onPress={() => back()} />
  );

  if (!supported) {
    return (
      <Screen>
        <Card>
          <AppText>El bloqueo con PIN está disponible en Android.</AppText>
        </Card>
      </Screen>
    );
  }

  if (mode.kind === 'create') {
    return (
      <Screen>
        <NewPinFlow
          title="Crea tu PIN"
          disabled={busy}
          error={error}
          onPin={pin =>
            run(async () => {
              await enablePin(pin);
              return 'PIN activado. Se pedirá al abrir la app.';
            })
          }
        >
          {cancel}
        </NewPinFlow>
      </Screen>
    );
  }

  if (mode.kind === 'change-current' || mode.kind === 'disable') {
    const disabling = mode.kind === 'disable';
    return (
      <Screen>
        <PinPad
          testID="current-pin"
          title="Ingresa tu PIN actual"
          disabled={busy}
          error={error}
          onComplete={current => {
            if (!disabling) {
              setError(null);
              setMode({ kind: 'change-new', current });
              return;
            }
            run(async () => {
              const result = await disablePin(current);
              if (!result.ok) {
                setError(rejected(result.lockedUntil));
                return null;
              }
              return 'PIN desactivado.';
            });
          }}
        >
          {cancel}
        </PinPad>
      </Screen>
    );
  }

  if (mode.kind === 'change-new') {
    return (
      <Screen>
        <NewPinFlow
          title="Elige tu PIN nuevo"
          disabled={busy}
          error={error}
          onPin={next =>
            run(async () => {
              const result = await changePin(mode.current, next);
              if (!result.ok) {
                setMode({ kind: 'change-current' });
                setError(rejected(result.lockedUntil));
                return null;
              }
              return 'PIN cambiado.';
            })
          }
        >
          {cancel}
        </NewPinFlow>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Bloqueo con PIN
        </AppText>
        <DetailRow label="Estado" value={enabled ? 'Activado' : 'Desactivado'} />
        <AppText variant="caption" color="textSecondary">
          Se pide un PIN de 6 dígitos al abrir la app y al volver después de 1
          minuto fuera de ella. Con el PIN activado, la app no muestra tus datos
          en "apps recientes". Si lo olvidas, puedes crear otro confirmando el
          bloqueo de pantalla de tu teléfono.
        </AppText>
      </Card>

      {notice !== null && (
        <AppText color="success" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      )}

      <View style={styles.actions}>
        {enabled ? (
          <>
            <Button
              testID="security-change"
              title="Cambiar PIN"
              variant="secondary"
              onPress={() => {
                setNotice(null);
                setMode({ kind: 'change-current' });
              }}
            />
            <Button
              testID="security-disable"
              title="Desactivar PIN"
              variant="danger"
              onPress={() => {
                setNotice(null);
                setMode({ kind: 'disable' });
              }}
            />
          </>
        ) : (
          <Button
            testID="security-enable"
            title="Activar PIN"
            onPress={() => {
              setNotice(null);
              setMode({ kind: 'create' });
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
});
