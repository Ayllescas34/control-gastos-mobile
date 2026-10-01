import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  AppText,
  Card,
  DemoBadge,
  EmptyState,
  Screen,
} from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import { TRANSACTION_TYPE_VISUALS } from '../components/transactionTypeVisuals';
import { findDemoTransaction } from '../demo/demoTransactions';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

export function TransactionDetailScreen({ route }: Props) {
  const transaction = findDemoTransaction(route.params.transactionId);

  if (!transaction) {
    return (
      <EmptyState
        title="Movimiento no encontrado"
        message="Este movimiento de demostración no existe."
      />
    );
  }

  const visual = TRANSACTION_TYPE_VISUALS[transaction.type];

  return (
    <Screen>
      <DemoBadge />
      <Card>
        <View style={styles.typeRow}>
          <IconBadge name={visual.icon} variant={visual.tone} size="sm" />
          <AppText variant="label" color="textSecondary">
            {visual.label}
          </AppText>
        </View>
        <AppText variant="title">{transaction.description}</AppText>
        <AppText variant="amountHero">
          {formatMoney(transaction.amountMinor, transaction.currency)}
        </AppText>
      </Card>
      <Card>
        <DetailRow
          label="Fecha"
          value={formatLocalDate(transaction.localDate, "d 'de' MMMM 'de' yyyy")}
        />
        <DetailRow label="Comercio" value={transaction.payee} />
        <DetailRow label="Nota" value={transaction.note} />
        <DetailRow label="Moneda" value={transaction.currency} />
      </Card>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <AppText color="textSecondary">{label}</AppText>
      <AppText variant="bodyStrong">{value ?? '—'}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
});
