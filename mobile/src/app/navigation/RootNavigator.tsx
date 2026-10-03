import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import {
  AccountDetailScreen,
  AccountFormScreen,
  AccountsScreen,
  CardDetailScreen,
  CardFormScreen,
} from '../../features/accounts';
import { BudgetFormScreen, BudgetsScreen } from '../../features/budgets';
import {
  CategoriesScreen,
  CategoryFormScreen,
} from '../../features/categories';
import {
  TransactionDetailScreen,
  TransactionFormScreen,
} from '../../features/transactions';
import { useAppTheme, type AppTheme } from '../../shared/theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function toNavigationTheme(theme: AppTheme): Theme {
  const base = theme.dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.expense,
    },
  };
}

/** Every app route. Rendered by RootNavigator; tests mount it in their own container. */
export function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: 'Detalle del movimiento' }}
      />
      <Stack.Screen
        name="NewTransaction"
        component={TransactionFormScreen}
        options={{ title: 'Nuevo movimiento', presentation: 'modal' }}
      />
      <Stack.Screen name="EditTransaction" component={TransactionFormScreen} />
      {/* Accounts management, reached from Settings. Form titles are set per mode. */}
      <Stack.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{ title: 'Cuentas' }}
      />
      <Stack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={{ title: 'Detalle de la cuenta' }}
      />
      <Stack.Screen name="AccountForm" component={AccountFormScreen} />
      <Stack.Screen
        name="CardDetail"
        component={CardDetailScreen}
        options={{ title: 'Detalle de la tarjeta' }}
      />
      <Stack.Screen name="CardForm" component={CardFormScreen} />
      {/* Categories management, reached from Settings. */}
      <Stack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: 'Categorías' }}
      />
      <Stack.Screen name="CategoryForm" component={CategoryFormScreen} />
      {/* Budgets management, reached from Settings. Form titles are set per mode. */}
      <Stack.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ title: 'Presupuestos' }}
      />
      <Stack.Screen name="BudgetForm" component={BudgetFormScreen} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={toNavigationTheme(theme)}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      <RootStack />
    </NavigationContainer>
  );
}
