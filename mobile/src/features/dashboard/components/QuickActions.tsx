import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/components';
import { IconBadge, type IconName, type IconTone } from '../../../shared/icons';
import { layout, radius, spacing, useAppTheme } from '../../../shared/theme';
import type { TransactionType } from '../../transactions';

const ACTIONS: readonly {
  type: TransactionType;
  label: string;
  hint: string;
  icon: IconName;
  tone: IconTone;
}[] = [
  {
    type: 'income',
    label: 'Ingreso',
    hint: 'Registra un depósito o un pago que recibiste',
    icon: 'arrowDown',
    tone: 'income',
  },
  {
    type: 'expense',
    label: 'Gasto',
    hint: 'Registra una compra o un pago',
    icon: 'arrowUp',
    tone: 'expense',
  },
  {
    type: 'transfer',
    label: 'Transferir',
    hint: 'Mueve dinero entre tus cuentas',
    icon: 'arrowLeftRight',
    tone: 'transfer',
  },
];

/** "Me depositaron Q500": one tap opens the movement form with the type already chosen. */
export function QuickActions({
  onAdd,
}: {
  onAdd: (type: TransactionType) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      {ACTIONS.map(action => (
        <Pressable
          key={action.type}
          testID={`quick-${action.type}`}
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${action.label.toLowerCase()}`}
          accessibilityHint={action.hint}
          onPress={() => onAdd(action.type)}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: pressed
                ? theme.colors.surfaceMuted
                : theme.colors.surface,
            },
            theme.shadows.sm,
          ]}
        >
          <IconBadge name={action.icon} variant={action.tone} />
          <AppText variant="label">{action.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    minHeight: layout.minTouchTarget,
  },
});
