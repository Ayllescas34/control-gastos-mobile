import { Fragment } from 'react';
import {
  AppText,
  Button,
  Card,
  LoadingState,
  Screen,
} from '../../../shared/components';
// By module, not the dashboard feature index: the same components and wording as Inicio.
import { CategoryBreakdown } from '../../dashboard/components/CategoryBreakdown';
import { formatPeriodLabel } from '../../dashboard/components/dashboardPresentation';
import { EvolutionChart } from '../../dashboard/components/EvolutionChart';
import { MonthSelector } from '../components/MonthSelector';
import { ReportSummary } from '../components/ReportSummary';
import { useMonthlyReport, useReportMonth } from '../hooks/useMonthlyReport';

/**
 * Reportes: real figures from SQLite for a chosen month (docs/reports.md). Reloads on focus
 * and when the month changes; the month selector stays visible in every state.
 */
export function ReportsScreen() {
  const { month, isCurrent, previous, next, toCurrent } = useReportMonth();
  const { resource, reload } = useMonthlyReport(month);
  const periodLabel = formatPeriodLabel(month);

  return (
    <Screen>
      <MonthSelector
        label={periodLabel}
        isCurrent={isCurrent}
        onPrevious={previous}
        onNext={next}
        onCurrent={toCurrent}
      />
      {resource.status === 'error' ? (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            No se pudo cargar el reporte
          </AppText>
          <AppText color="textSecondary">
            Tus datos siguen guardados en el dispositivo. Intenta de nuevo.
          </AppText>
          <Button testID="reports-retry" title="Reintentar" onPress={reload} />
        </Card>
      ) : resource.status === 'loading' ||
        // A reload keeps the previous month visible: never show it under the new label.
        resource.data.period.from !== month ? (
        <LoadingState accessibilityLabel="Cargando el reporte" />
      ) : resource.data.reports.length === 0 ? (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            Sin movimientos
          </AppText>
          <AppText testID="reports-empty" color="textSecondary">
            No hay ingresos ni gastos registrados en {periodLabel}. Las
            transferencias entre tus cuentas no cuentan como ingresos ni gastos.
          </AppText>
        </Card>
      ) : (
        resource.data.reports.map(report => (
          <Fragment key={report.currency}>
            {resource.data.reports.length > 1 && (
              <AppText variant="title" accessibilityRole="header">
                {report.currency}
              </AppText>
            )}
            <ReportSummary report={report} />
            <CategoryBreakdown
              summary={report}
              references={resource.data.references}
              testIDPrefix="reports"
              emptyMessage="Sin gastos en este mes."
            />
            <EvolutionChart
              summary={report}
              period={resource.data.period}
              periodLabel={periodLabel}
              testIDPrefix="reports"
              periodDescription="del mes"
            />
          </Fragment>
        ))
      )}
    </Screen>
  );
}
