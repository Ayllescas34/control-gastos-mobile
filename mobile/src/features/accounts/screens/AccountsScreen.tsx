import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
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
import { AccountListItem } from '../components/AccountListItem';
import { describeAccountsError } from '../components/accountMessages';
import { CardListItem } from '../components/CardListItem';
import { useAccountsOverview } from '../hooks/accountQueries';

type Props = NativeStackScreenProps<RootStackParamList, 'Accounts'>;

/** Active accounts and cards, persisted in SQLite. No demo data: a new install is empty. */
export function AccountsScreen({ navigation }: Props) {
  const { resource, reload } = useAccountsOverview();

  const addAccount = () => navigation.navigate('AccountForm');
  const openAccount = (accountId: string) =>
    navigation.navigate('AccountDetail', { accountId });
  const openCard = (cardId: string) =>
    navigation.navigate('CardDetail', { cardId });

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando cuentas" />;
  }

  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus cuentas"
        message={describeAccountsError(resource.error)}
      >
        <Button testID="accounts-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { accounts, cards, balances } = resource.data;
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="No tienes cuentas todavía"
        message="Agrega tus cuentas de banco, efectivo, ahorros o crédito para empezar a organizar tu dinero."
      >
        <Button
          testID="accounts-empty-add"
          title="Agregar cuenta"
          onPress={addAccount}
        />
      </EmptyState>
    );
  }

  const accountsById = new Map(accounts.map(account => [account.id, account]));

  return (
    <Screen>
      <SectionHeader
        title="Cuentas"
        action={{
          testID: 'accounts-add-account',
          label: 'Agregar cuenta',
          icon: 'add',
          onPress: addAccount,
        }}
      />
      <Card>
        {accounts.map(account => (
          <AccountListItem
            key={account.id}
            account={account}
            balanceMinor={balances[account.id] ?? account.initialBalanceMinor}
            onPress={openAccount}
          />
        ))}
      </Card>

      <SectionHeader
        title="Tarjetas"
        action={{
          testID: 'accounts-add-card',
          label: 'Agregar tarjeta',
          icon: 'add',
          onPress: () => navigation.navigate('CardForm'),
        }}
      />
      <Card style={cards.length === 0 && styles.emptyCards}>
        {cards.length === 0 ? (
          <AppText color="textSecondary">
            Aún no tienes tarjetas. Agrega una para identificar con qué pagas.
          </AppText>
        ) : (
          cards.map(card => (
            <CardListItem
              key={card.id}
              card={card}
              account={accountsById.get(card.accountId)}
              onPress={openCard}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCards: {
    paddingVertical: spacing.xl,
  },
});
