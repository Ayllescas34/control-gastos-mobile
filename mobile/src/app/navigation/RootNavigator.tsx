import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import {
  NewTransactionScreen,
  TransactionDetailScreen,
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
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.expense,
    },
  };
}

export function RootNavigator() {
  const theme = useAppTheme();

  return (
    <NavigationContainer theme={toNavigationTheme(theme)}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
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
          component={NewTransactionScreen}
          options={{ title: 'Nuevo movimiento', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
