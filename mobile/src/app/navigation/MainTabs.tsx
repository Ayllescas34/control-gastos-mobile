import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { DashboardScreen } from '../../features/dashboard';
import { ReportsScreen } from '../../features/reports';
import { SettingsScreen } from '../../features/settings';
import { TransactionsScreen } from '../../features/transactions';
import { typography } from '../../shared/theme';
import { AddTabButton } from './AddTabButton';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyTabScreen() {
  return null;
}

const renderAddTabButton = (props: BottomTabBarButtonProps) => (
  <AddTabButton {...props} />
);

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        // No icon library yet: tabs show text labels only.
        tabBarIconStyle: { display: 'none' },
        // Smaller than caption so five labels fit on narrow screens.
        tabBarLabelStyle: styles.tabLabel,
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Control de Gastos', tabBarLabel: 'Inicio' }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Movimientos' }}
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
        options={{ title: 'Reportes' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configuración' }}
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
