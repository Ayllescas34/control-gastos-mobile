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
};

declare global {
  namespace ReactNavigation {
    // Enables typed useNavigation() across the app (official React Navigation pattern).
    interface RootParamList extends RootStackParamList {}
  }
}
