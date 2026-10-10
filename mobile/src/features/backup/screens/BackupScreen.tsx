import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  DetailRow,
  Screen,
} from '../../../shared/components';
import { Icon, type IconName } from '../../../shared/icons';
import { formatLocalDate, toLocalDate } from '../../../shared/lib/dates';
import { spacing, type ColorName } from '../../../shared/theme';
import {
  BACKUP_TABLE_LABELS,
  backupErrorLogSummary,
  describeExportError,
  describeRestoreError,
} from '../components/backupMessages';
import { BACKUP_TABLES, type BackupSummary } from '../domain/types';
import { useBackupActions, type ReadBackupResult } from '../hooks/useBackup';

type Notice = { tone: 'success' | 'info' | 'error'; message: string };

type BackupState =
  | { step: 'idle'; notice: Notice | null; restored?: true }
  | { step: 'exporting' }
  | { step: 'reading' }
  | { step: 'review'; file: Extract<ReadBackupResult, { status: 'ready' }> }
  | {
      step: 'restoring';
      file: Extract<ReadBackupResult, { status: 'ready' }>;
    };

const NOTICE_VISUALS: Record<
  Notice['tone'],
  { icon: IconName; color: ColorName }
> = {
  success: { icon: 'success', color: 'success' },
  info: { icon: 'info', color: 'textSecondary' },
  error: { icon: 'error', color: 'error' },
};

const idle = (
  notice: Notice | null = null,
): Extract<BackupState, { step: 'idle' }> => ({
  step: 'idle',
  notice,
});

/** "12 (2 archivados)" */
function countText({ total, archived }: { total: number; archived: number }) {
  return archived > 0
    ? `${total} (${archived} ${archived === 1 ? 'archivado' : 'archivados'})`
    : String(total);
}

/**
 * Configuración → Respaldo de datos. Export writes a JSON file where the user chooses.
 * Restore reads and validates a file, shows what it holds and, only after an explicit
 * confirmation, replaces all data in one transaction. Other screens reload on focus, so
 * they show the restored data when the user goes back.
 */
export function BackupScreen() {
  const navigation = useNavigation();
  const actions = useBackupActions();
  const [state, setState] = useState<BackupState>(idle());
  const busy = state.step !== 'idle' && state.step !== 'review';

  async function exportBackup() {
    setState({ step: 'exporting' });
    try {
      const result = await actions.exportToFile();
      setState(
        idle(
          result === 'saved'
            ? {
                tone: 'success',
                message:
                  'Respaldo guardado. Consérvalo en un lugar seguro: no está cifrado.',
              }
            : { tone: 'info', message: 'Exportación cancelada.' },
        ),
      );
    } catch (error) {
      console.error('Backup export failed', backupErrorLogSummary(error));
      setState(idle({ tone: 'error', message: describeExportError(error) }));
    }
  }

  async function readBackup() {
    setState({ step: 'reading' });
    try {
      const file = await actions.readFromFile();
      setState(
        file.status === 'ready'
          ? { step: 'review', file }
          : idle({
              tone: 'info',
              message: 'No elegiste ningún archivo. Tus datos no cambiaron.',
            }),
      );
    } catch (error) {
      console.error('Backup read failed', backupErrorLogSummary(error));
      setState(idle({ tone: 'error', message: describeRestoreError(error) }));
    }
  }

  async function restore(file: Extract<ReadBackupResult, { status: 'ready' }>) {
    setState({ step: 'restoring', file });
    try {
      await actions.restore(file.backup);
      setState({
        ...idle({
          tone: 'success',
          message: 'Respaldo restaurado. Tus datos ahora son los del archivo.',
        }),
        restored: true,
      });
    } catch (error) {
      console.error('Backup restore failed', backupErrorLogSummary(error));
      setState(idle({ tone: 'error', message: describeRestoreError(error) }));
    }
  }

  function confirmRestore(file: Extract<ReadBackupResult, { status: 'ready' }>) {
    Alert.alert(
      '¿Sustituir todos tus datos?',
      'Tus cuentas, movimientos y demás datos actuales se reemplazarán por los del respaldo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sustituir datos',
          style: 'destructive',
          onPress: () => restore(file),
        },
      ],
    );
  }

  const notice = state.step === 'idle' ? state.notice : null;

  return (
    <Screen>
      <Card style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Exportar
        </AppText>
        <AppText>
          Guarda en un archivo tus cuentas, tarjetas, categorías, movimientos,
          presupuestos y metas de ahorro, también los archivados.
        </AppText>
        <View style={styles.warning}>
          <Icon name="warning" size="sm" color="warning" />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            El archivo no está cifrado y contiene tus datos financieros.
            Guárdalo en un lugar seguro y no lo compartas.
          </AppText>
        </View>
        <Button
          testID="backup-export"
          title="Exportar respaldo"
          onPress={exportBackup}
          loading={state.step === 'exporting'}
          disabled={busy}
          accessibilityHint="Abre el selector para elegir dónde guardar el archivo"
        />
      </Card>

      <Card style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          Restaurar
        </AppText>
        <AppText>
          Restaurar sustituye todos los datos actuales de la app por los del
          archivo. Antes de cambiar nada verás un resumen y tendrás que
          confirmar.
        </AppText>
        <Button
          testID="backup-restore"
          title="Restaurar respaldo"
          variant="secondary"
          onPress={readBackup}
          loading={state.step === 'reading'}
          disabled={busy || state.step === 'review'}
          accessibilityHint="Abre el selector para elegir un archivo de respaldo"
        />
      </Card>

      {(state.step === 'review' || state.step === 'restoring') && (
        <ReviewCard
          summary={state.file.summary}
          restoring={state.step === 'restoring'}
          onConfirm={() => confirmRestore(state.file)}
          onCancel={() =>
            setState(
              idle({
                tone: 'info',
                message: 'Restauración cancelada. Tus datos no cambiaron.',
              }),
            )
          }
        />
      )}

      {notice && (
        <View
          testID="backup-notice"
          style={styles.notice}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={notice.message}
        >
          <Icon
            name={NOTICE_VISUALS[notice.tone].icon}
            size="sm"
            color={NOTICE_VISUALS[notice.tone].color}
          />
          <AppText
            color={notice.tone === 'error' ? 'error' : 'textPrimary'}
            style={styles.flex}
          >
            {notice.message}
          </AppText>
        </View>
      )}

      {state.step === 'idle' && state.restored && (
        // Back to the tabs: every screen reloads from SQLite when it regains focus.
        <Button
          testID="backup-go-home"
          title="Ir al inicio"
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
          accessibilityHint="Muestra el inicio con los datos restaurados"
        />
      )}
    </Screen>
  );
}

function ReviewCard({
  summary,
  restoring,
  onConfirm,
  onCancel,
}: {
  summary: BackupSummary;
  restoring: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const exportedOn = formatLocalDate(
    toLocalDate(new Date(summary.exportedAt)),
  );

  return (
    <Card style={styles.section}>
      <View testID="backup-summary" accessible accessibilityLiveRegion="polite">
        <AppText variant="heading" accessibilityRole="header">
          Respaldo del {exportedOn}
        </AppText>
        <AppText color="textSecondary">El archivo es válido y contiene:</AppText>
      </View>
      {BACKUP_TABLES.map(table => (
        <DetailRow
          key={table}
          label={BACKUP_TABLE_LABELS[table]}
          value={countText(summary.tables[table])}
        />
      ))}
      <View style={styles.warning}>
        <Icon name="warning" size="sm" color="warning" />
        <AppText color="warning" style={styles.flex}>
          Restaurar reemplazará todos tus datos actuales por los de este
          archivo.
        </AppText>
      </View>
      <Button
        testID="backup-confirm-restore"
        title="Sustituir mis datos"
        variant="danger"
        onPress={onConfirm}
        loading={restoring}
        accessibilityHint="Pide confirmación antes de reemplazar tus datos"
      />
      <Button
        testID="backup-cancel-restore"
        title="Cancelar"
        variant="secondary"
        onPress={onCancel}
        disabled={restoring}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
