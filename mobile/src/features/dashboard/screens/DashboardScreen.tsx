import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  DemoBadge,
  Screen,
} from '../../../shared/components';
import { formatMoney } from '../../../shared/lib/money';
import { spacing } from '../../../shared/theme';
import {
  DEMO_TRANSACTIONS,
  TransactionListItem,
} from '../../transactions';
import { DEMO_SUMMARY } from '../demo/demoSummary';

const RECENT_COUNT = 3;

export function DashboardScreen() {
  const navigation = useNavigation();
  const { currency } = DEMO_SUMMARY;

  return (
    <Screen>
      <DemoBadge />

      <Card>
        <AppText variant="caption" color="textSecondary">
          Balance · {DEMO_SUMMARY.periodLabel}
        </AppText>
        <AppText variant="amountHero">
          {formatMoney(DEMO_SUMMARY.balanceMinor, currency)}
        </AppText>
      </Card>

      <View style={styles.row}>
        <Card style={styles.half}>
          <AppText variant="caption" color="textSecondary">
            Ingresos
          </AppText>
          <AppText variant="heading" color="income">
            {formatMoney(DEMO_SUMMARY.incomeMinor, currency)}
          </AppText>
        </Card>
        <Card style={styles.half}>
          <AppText variant="caption" color="textSecondary">
            Gastos
          </AppText>
          <AppText variant="heading" color="expense">
            {formatMoney(DEMO_SUMMARY.expenseMinor, currency)}
          </AppText>
        </Card>
      </View>

      <Card>
        <AppText variant="heading">Movimientos recientes</AppText>
        {DEMO_TRANSACTIONS.slice(0, RECENT_COUNT).map(transaction => (
          <TransactionListItem
            key={transaction.id}
            transaction={transaction}
            onPress={transactionId =>
              navigation.navigate('TransactionDetail', { transactionId })
            }
          />
        ))}
      </Card>

      <Button
        title="Ver todos los movimientos"
        variant="secondary"
        onPress={() =>
          navigation.navigate('MainTabs', { screen: 'Transactions' })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  half: {
    flex: 1,
  },
});
