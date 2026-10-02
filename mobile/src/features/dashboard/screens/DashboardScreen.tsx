import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  DemoBadge,
  Screen,
} from '../../../shared/components';
import { formatMoney } from '../../../shared/lib/money';
import { spacing, useAppTheme } from '../../../shared/theme';
import {
  TransactionListItem,
  useTransactions,
  type TransactionFilters,
} from '../../transactions';
import { DEMO_SUMMARY } from '../demo/demoSummary';

/** Stable object: the hook reloads when its filters change identity. */
const RECENT: TransactionFilters = { limit: 3 };

/**
 * The summary cards are still demo data (marked by DemoBadge) until the dashboard metrics
 * are implemented; "Movimientos recientes" shows the real latest movements.
 */
export function DashboardScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { currency } = DEMO_SUMMARY;
  const { resource } = useTransactions(RECENT);

  return (
    <Screen>
      <View style={styles.demo}>
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
      </View>

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Movimientos recientes
        </AppText>
        {resource.status === 'loading' && (
          <ActivityIndicator
            color={theme.colors.primary}
            accessibilityLabel="Cargando movimientos recientes"
          />
        )}
        {resource.status === 'error' && (
          <AppText color="error">
            No se pudieron cargar tus movimientos recientes.
          </AppText>
        )}
        {resource.status === 'ready' &&
          (resource.data.transactions.length === 0 ? (
            <AppText color="textSecondary">
              Aún no tienes movimientos. Usa el botón + para registrar el
              primero.
            </AppText>
          ) : (
            resource.data.transactions.map(transaction => (
              <TransactionListItem
                key={transaction.id}
                transaction={transaction}
                references={resource.data.references}
                onPress={transactionId =>
                  navigation.navigate('TransactionDetail', { transactionId })
                }
              />
            ))
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
  demo: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  half: {
    flex: 1,
  },
});
