import { useNavigation } from '@react-navigation/native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../shared/components';
import { spacing } from '../../../shared/theme';
import { TransactionListItem } from '../../transactions';
import { WalletConnectionCard } from '../../wallet';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { formatPeriodLabel } from '../components/dashboardPresentation';
import { EvolutionChart } from '../components/EvolutionChart';
import {
  AccountSpendingCard,
  BalanceTrendCard,
  CategoryDonutCard,
  TrendCard,
} from '../components/InsightCards';
import { QuickActions } from '../components/QuickActions';
import { SummaryCards } from '../components/SummaryCards';
import { WalletCarousel } from '../components/WalletCarousel';
import { useDashboard } from '../hooks/useDashboard';

/**
 * Inicio, laid out like a wallet: the accounts as cards, the Google Wallet status, then the
 * current month's real figures from SQLite (docs/dashboard.md). Reloads on focus, so
 * changes made on other screens (and new Google Wallet payments) show up when coming back.
 */
export function DashboardScreen() {
  const navigation = useNavigation();
  const { resource, reload } = useDashboard();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando tu resumen" />;
  }

  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar tu resumen"
        message="Tus datos siguen guardados en el dispositivo. Intenta de nuevo."
      >
        <Button testID="dashboard-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const {
    period,
    summaries,
    recentTransactions,
    references,
    walletAccounts,
    wallet,
    insights,
    isEmpty,
  } = resource.data;

  if (isEmpty) {
    return (
      <EmptyState
        icon="wallet"
        title="Tu resumen está vacío"
        message="Agrega tu primera cuenta y registra un movimiento para ver aquí tu balance, ingresos y gastos."
      >
        <Button
          testID="dashboard-empty-add-account"
          title="Agregar cuenta"
          onPress={() => navigation.navigate('AccountForm')}
        />
      </EmptyState>
    );
  }

  const periodLabel = formatPeriodLabel(period.from);
  const showCurrency = summaries.length > 1;

  return (
    <Screen>
      <View style={styles.section}>
        <SectionHeader
          title="Tus tarjetas"
          action={{
            label: 'Administrar',
            testID: 'dashboard-manage-accounts',
            accessibilityHint: 'Abre la administración de cuentas y tarjetas',
            onPress: () => navigation.navigate('Accounts'),
          }}
        />
        <WalletCarousel
          accounts={walletAccounts}
          onOpenAccount={accountId =>
            navigation.navigate('AccountDetail', { accountId })
          }
          onAddAccount={() => navigation.navigate('AccountForm')}
        />
      </View>

      <QuickActions
        onAdd={type => navigation.navigate('NewTransaction', { type })}
      />

      {wallet.connection !== 'unsupported' && (
        <WalletConnectionCard
          testID="dashboard-wallet"
          connection={wallet.connection}
          reviewCount={wallet.reviewCount}
          onPress={() => navigation.navigate('Wallet')}
        />
      )}

      {summaries.map(summary => {
        const charts = insights.find(
          item => item.currency === summary.currency,
        );
        return (
          <Fragment key={summary.currency}>
            {showCurrency && (
              <AppText variant="title" accessibilityRole="header">
                {summary.currency}
              </AppText>
            )}
            <SummaryCards summary={summary} periodLabel={periodLabel} />
            {charts && (
              <>
                <TrendCard insights={charts} testIDPrefix="dashboard" />
                <BalanceTrendCard insights={charts} testIDPrefix="dashboard" />
                <CategoryDonutCard insights={charts} testIDPrefix="dashboard" />
              </>
            )}
            <CategoryBreakdown summary={summary} references={references} />
            {charts && (
              <AccountSpendingCard insights={charts} testIDPrefix="dashboard" />
            )}
            <EvolutionChart
              summary={summary}
              period={period}
              periodLabel={periodLabel}
            />
          </Fragment>
        );
      })}

      <Card>
        <AppText variant="heading" accessibilityRole="header">
          Movimientos recientes
        </AppText>
        {recentTransactions.length === 0 ? (
          <AppText color="textSecondary">
            Aún no tienes movimientos. Usa el botón + para registrar el primero.
          </AppText>
        ) : (
          recentTransactions.map(transaction => (
            <TransactionListItem
              key={transaction.id}
              transaction={transaction}
              references={references}
              onPress={transactionId =>
                navigation.navigate('TransactionDetail', { transactionId })
              }
            />
          ))
        )}
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
  section: {
    gap: spacing.sm,
  },
});
