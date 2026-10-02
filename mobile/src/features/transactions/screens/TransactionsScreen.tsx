import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  ChoiceGroup,
  EmptyState,
  LoadingState,
  TextField,
} from '../../../shared/components';
import { Icon } from '../../../shared/icons';
import {
  formatLocalDate,
  localDateDaysBefore,
  todayLocalDate,
} from '../../../shared/lib/dates';
import { layout, spacing, useAppTheme } from '../../../shared/theme';
import type { Transaction } from '../domain/types';
import type { ReferenceLookup } from '../components/referenceLookup';
import {
  DEFAULT_FILTERS,
  extraFilterCount,
  PERIOD_OPTIONS,
  toRepositoryFilters,
  TYPE_FILTER_OPTIONS,
  type TransactionFilterState,
} from '../components/transactionFilters';
import { TransactionListItem } from '../components/TransactionListItem';
import { describeTransactionsError } from '../components/transactionMessages';
import { useTransactions } from '../hooks/transactionHooks';

/** Waits for a pause in typing before querying SQLite. */
const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';

type DaySection = { title: string; data: Transaction[] };

function dayTitle(localDate: string, today: string): string {
  if (localDate === today) {
    return 'Hoy';
  }
  if (localDate === localDateDaysBefore(today, 1)) {
    return 'Ayer';
  }
  return formatLocalDate(localDate, "EEEE d 'de' MMMM yyyy");
}

/** Movements (already ordered by date) grouped by civil day. */
function groupByDay(transactions: Transaction[]): DaySection[] {
  const today = todayLocalDate();
  const sections: DaySection[] = [];
  for (const transaction of transactions) {
    const title = dayTitle(transaction.localDate, today);
    const last = sections[sections.length - 1];
    if (last?.title === title) {
      last.data.push(transaction);
    } else {
      sections.push({ title, data: [transaction] });
    }
  }
  return sections;
}

/** Real movements from SQLite, with search and filters evaluated by the repository. */
export function TransactionsScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const [filters, setFilters] =
    useState<TransactionFilterState>(DEFAULT_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const repositoryFilters = useMemo(
    () => toRepositoryFilters(filters, search),
    [filters, search],
  );
  const { resource, reload } = useTransactions(repositoryFilters);

  const sections = useMemo(
    () =>
      resource.status === 'ready' ? groupByDay(resource.data.transactions) : [],
    [resource],
  );

  const addTransaction = () => navigation.navigate('NewTransaction');
  const openTransaction = (transactionId: string) =>
    navigation.navigate('TransactionDetail', { transactionId });

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando movimientos" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus movimientos"
        message={describeTransactionsError(resource.error)}
      >
        <Button
          testID="transactions-retry"
          title="Reintentar"
          onPress={reload}
        />
      </EmptyState>
    );
  }

  const { transactions, references } = resource.data;
  const filtering =
    search.trim().length > 0 ||
    filters.type !== 'all' ||
    extraFilterCount(filters) > 0;

  if (transactions.length === 0 && !filtering) {
    return (
      <EmptyState
        icon="transactions"
        title="No tienes movimientos todavía"
        message="Registra tus gastos, ingresos y transferencias para ver aquí tu historial."
      >
        <Button
          testID="transactions-empty-add"
          title="Agregar movimiento"
          onPress={addTransaction}
        />
      </EmptyState>
    );
  }

  const header = (
    <Filters
      filters={filters}
      onChange={setFilters}
      searchText={searchText}
      onSearch={setSearchText}
      expanded={showFilters}
      onToggle={() => setShowFilters(current => !current)}
      references={references}
    />
  );

  return (
    <SectionList
      testID="transactions-list"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={item => item.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <AppText color="textSecondary" style={styles.noResults}>
          No hay movimientos que coincidan con tu búsqueda o filtros.
        </AppText>
      }
      renderSectionHeader={({ section }) => (
        <AppText
          variant="label"
          color="textSecondary"
          accessibilityRole="header"
          style={styles.dayHeader}
        >
          {section.title}
        </AppText>
      )}
      renderItem={({ item }) => (
        <TransactionListItem
          transaction={item}
          references={references}
          onPress={openTransaction}
          showDate={false}
        />
      )}
    />
  );
}

type FiltersProps = {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
  searchText: string;
  onSearch: (text: string) => void;
  expanded: boolean;
  onToggle: () => void;
  references: ReferenceLookup;
};

function Filters({
  filters,
  onChange,
  searchText,
  onSearch,
  expanded,
  onToggle,
  references,
}: FiltersProps) {
  const extra = extraFilterCount(filters);
  const update = (next: Partial<TransactionFilterState>) =>
    onChange({ ...filters, ...next });
  const categories =
    filters.type === 'income'
      ? references.categoriesOf('income')
      : filters.type === 'expense'
      ? references.categoriesOf('expense')
      : [
          ...references.categoriesOf('expense'),
          ...references.categoriesOf('income'),
        ];

  return (
    <View style={styles.filters}>
      <TextField
        testID="transactions-search"
        label="Buscar"
        value={searchText}
        onChangeText={onSearch}
        placeholder="Comercio, descripción o nota"
        returnKeyType="search"
      />
      <ChoiceGroup
        testID="transactions-type"
        label="Tipo"
        options={TYPE_FILTER_OPTIONS}
        value={filters.type}
        onChange={type => update({ type })}
      />
      <Pressable
        testID="transactions-filters-toggle"
        accessibilityRole="button"
        accessibilityLabel={
          extra > 0 ? `Más filtros, ${extra} activos` : 'Más filtros'
        }
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.toggle}
      >
        <Icon name="filter" size="sm" color="primary" />
        <AppText variant="label" color="primary">
          {extra > 0 ? `Más filtros (${extra})` : 'Más filtros'}
        </AppText>
        <Icon
          name={expanded ? 'chevronDown' : 'chevronRight'}
          size="sm"
          color="primary"
        />
      </Pressable>
      {expanded && (
        <Card style={styles.filterCard}>
          <ChoiceGroup
            testID="transactions-period"
            label="Período"
            options={PERIOD_OPTIONS}
            value={filters.period}
            onChange={period => update({ period })}
          />
          <ChoiceGroup
            testID="transactions-account"
            label="Cuenta"
            options={[
              { value: ALL, label: 'Todas' },
              ...references.activeAccounts.map(account => ({
                value: account.id,
                label: account.name,
              })),
            ]}
            value={filters.accountId ?? ALL}
            onChange={accountId =>
              update({ accountId: accountId === ALL ? null : accountId })
            }
          />
          {filters.type !== 'transfer' && (
            <ChoiceGroup
              testID="transactions-category"
              label="Categoría"
              options={[
                { value: ALL, label: 'Todas' },
                ...categories.map(category => ({
                  value: category.id,
                  // Archived ones stay filterable: past movements still use them.
                  label:
                    category.deletedAt === null
                      ? category.name
                      : `${category.name} (archivada)`,
                  icon: category.icon,
                })),
              ]}
              value={filters.categoryId ?? ALL}
              onChange={categoryId =>
                update({ categoryId: categoryId === ALL ? null : categoryId })
              }
            />
          )}
          {extra > 0 && (
            <Button
              testID="transactions-clear-filters"
              title="Quitar filtros"
              variant="secondary"
              onPress={() =>
                onChange({ ...DEFAULT_FILTERS, type: filters.type })
              }
            />
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
  },
  filters: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget,
  },
  filterCard: {
    gap: spacing.lg,
  },
  dayHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  noResults: {
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});
