import { AppText, Card, ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';
import type { CurrencySummary } from '../domain/dashboardSummary';
import { describeCategory, formatShare } from './dashboardPresentation';

type CategoryBreakdownProps = {
  summary: CurrencySummary;
  references: ReferenceLookup;
};

/** The month's expenses per category, largest first, with their share of the total. */
export function CategoryBreakdown({
  summary,
  references,
}: CategoryBreakdownProps) {
  const { currency, categories, expenseMinor } = summary;

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        Gastos por categoría
      </AppText>
      {categories.length === 0 ? (
        <AppText color="textSecondary">Sin gastos este mes.</AppText>
      ) : (
        categories.map(({ categoryId, totalMinor }) => {
          const category = describeCategory(categoryId, references);
          const amount = formatMoney(totalMinor, currency);
          const share = formatShare(totalMinor, expenseMinor);
          const subtitle = [
            share && `${share} de tus gastos`,
            category.archived && 'Archivada',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <ListItem
              key={categoryId ?? 'uncategorized'}
              testID={`dashboard-category-${categoryId ?? 'none'}-${currency}`}
              title={category.name}
              subtitle={subtitle}
              leading={<IconBadge name={category.icon} variant="expense" />}
              trailing={
                <AppText variant="amount" color="expense">
                  {amount}
                </AppText>
              }
              accessibilityLabel={`${category.name}, ${amount}, ${subtitle}`}
            />
          );
        })
      )}
    </Card>
  );
}
