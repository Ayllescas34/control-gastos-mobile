import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  /** Placeholder tab: pressing it opens the NewTransaction modal instead. */
  AddAction: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  TransactionDetail: { transactionId: string };
  NewTransaction: undefined;
  Accounts: undefined;
  AccountDetail: { accountId: string };
  /** Without accountId: create. With it: edit that account. */
  AccountForm: { accountId?: string } | undefined;
  CardDetail: { cardId: string };
  /** cardId: edit that card. accountId (create only): preselects the account. */
  CardForm: { cardId?: string; accountId?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    // Enables typed useNavigation() across the app (official React Navigation pattern).
    interface RootParamList extends RootStackParamList {}
  }
}
