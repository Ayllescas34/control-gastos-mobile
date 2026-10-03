import { useNavigation } from '@react-navigation/native';
import { Fragment } from 'react';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { TransactionListItem } from '../../transactions';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { formatPeriodLabel } from '../components/dashboardPresentation';
import { EvolutionChart } from '../components/EvolutionChart';
import { SummaryCards } from '../components/SummaryCards';
import { useDashboard } from '../hooks/useDashboard';

/**
 * Inicio: real figures from SQLite for the current month (docs/dashboard.md). Reloads on
 * focus, so changes made on other screens show up when coming back.
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

  const { period, summaries, recentTransactions, references, isEmpty } =
    resource.data;

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
      {summaries.map(summary => (
        <Fragment key={summary.currency}>
          {showCurrency && (
            <AppText variant="title" accessibilityRole="header">
              {summary.currency}
            </AppText>
          )}
          <SummaryCards summary={summary} periodLabel={periodLabel} />
          <EvolutionChart
            summary={summary}
            period={period}
            periodLabel={periodLabel}
          />
          <CategoryBreakdown summary={summary} references={references} />
        </Fragment>
      ))}

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
