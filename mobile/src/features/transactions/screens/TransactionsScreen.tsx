import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet } from 'react-native';
import { DemoBadge, Screen } from '../../../shared/components';
import { spacing } from '../../../shared/theme';
import { TransactionListItem } from '../components/TransactionListItem';
import { DEMO_TRANSACTIONS } from '../demo/demoTransactions';

export function TransactionsScreen() {
  const navigation = useNavigation();

  return (
    <Screen scrollable={false}>
      <FlatList
        data={DEMO_TRANSACTIONS}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<DemoBadge />}
        ListHeaderComponentStyle={styles.header}
        renderItem={({ item }) => (
          <TransactionListItem
            transaction={item}
            onPress={transactionId =>
              navigation.navigate('TransactionDetail', { transactionId })
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.sm,
  },
});
