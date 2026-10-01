import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { DashboardScreen } from '../../features/dashboard';
import { ReportsScreen } from '../../features/reports';
import { SettingsScreen } from '../../features/settings';
import { TransactionsScreen } from '../../features/transactions';
import { Icon, type IconName } from '../../shared/icons';
import { typography, useAppTheme } from '../../shared/theme';
import { AddTabButton } from './AddTabButton';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyTabScreen() {
  return null;
}

const renderAddTabButton = (props: BottomTabBarButtonProps) => (
  <AddTabButton {...props} />
);

/** Decorative: the tab button already announces its label and selected state. */
const tabIcon =
  (name: IconName) =>
  ({ focused }: { focused: boolean }) =>
    (
      <Icon
        name={name}
        size="lg"
        color={focused ? 'primary' : 'textSecondary'}
      />
    );

const DASHBOARD_ICON = tabIcon('home');
const TRANSACTIONS_ICON = tabIcon('transactions');
const REPORTS_ICON = tabIcon('reports');
const SETTINGS_ICON = tabIcon('settings');

export function MainTabs() {
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        // Labels use the same tokens as the icons.
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        // Smaller than caption so five labels fit on narrow screens.
        tabBarLabelStyle: styles.tabLabel,
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Control de Gastos',
          tabBarLabel: 'Inicio',
          tabBarIcon: DASHBOARD_ICON,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Movimientos', tabBarIcon: TRANSACTIONS_ICON }}
      />
      <Tab.Screen
        name="AddAction"
        component={EmptyTabScreen}
        options={{ tabBarButton: renderAddTabButton }}
        listeners={({ navigation }) => ({
          tabPress: event => {
            event.preventDefault();
            // The modal lives in the root stack, not in the tab navigator.
            navigation.getParent()?.navigate('NewTransaction');
          },
        })}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reportes', tabBarIcon: REPORTS_ICON }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configuración', tabBarIcon: SETTINGS_ICON }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
  },
});
