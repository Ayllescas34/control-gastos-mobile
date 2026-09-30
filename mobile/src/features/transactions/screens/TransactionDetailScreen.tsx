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
import { formatLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import { findDemoTransaction } from '../demo/demoTransactions';
import type { TransactionType } from '../domain/types';

const TYPE_LABEL: Record<TransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
};

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

  return (
    <Screen>
      <DemoBadge />
      <Card>
        <AppText variant="caption" color="textMuted">
          {TYPE_LABEL[transaction.type]}
        </AppText>
        <AppText variant="title">{transaction.description}</AppText>
        <AppText variant="display">
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
      <AppText color="textMuted">{label}</AppText>
      <AppText variant="bodyStrong">{value ?? '—'}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
});
