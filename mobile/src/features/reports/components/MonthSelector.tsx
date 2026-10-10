import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card } from '../../../shared/components';
import { IconButton } from '../../../shared/icons';
import { spacing } from '../../../shared/theme';

type MonthSelectorProps = {
  /** "Octubre 2026". */
  label: string;
  isCurrent: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onCurrent: () => void;
};

/** The report's month, with the previous and next months and a way back to the current one. */
export function MonthSelector({
  label,
  isCurrent,
  onPrevious,
  onNext,
  onCurrent,
}: MonthSelectorProps) {
  return (
    <Card>
      <View style={styles.row}>
        <IconButton
          testID="reports-previous-month"
          icon="back"
          accessibilityLabel="Mes anterior"
          onPress={onPrevious}
        />
        <View
          testID="reports-month"
          style={styles.label}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Reporte de ${label}${
            isCurrent ? ', mes actual' : ''
          }`}
          accessibilityLiveRegion="polite"
        >
          <AppText variant="heading" style={styles.centered}>
            {label}
          </AppText>
          {isCurrent && (
            <AppText
              variant="caption"
              color="textSecondary"
              style={styles.centered}
            >
              Mes actual
            </AppText>
          )}
        </View>
        <IconButton
          testID="reports-next-month"
          icon="forward"
          accessibilityLabel="Mes siguiente"
          accessibilityHint={
            isCurrent ? 'No hay meses futuros con movimientos' : undefined
          }
          disabled={isCurrent}
          onPress={onNext}
        />
      </View>
      {!isCurrent && (
        <Button
          testID="reports-current-month"
          title="Volver al mes actual"
          variant="secondary"
          onPress={onCurrent}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
});
