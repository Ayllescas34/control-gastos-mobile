import { useNavigation } from '@react-navigation/native';
import { AppText, Card, ListItem, Screen } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';

export function SettingsScreen() {
  const navigation = useNavigation();

  return (
    <Screen>
      <Card>
        <ListItem
          testID="settings-accounts"
          title="Cuentas"
          subtitle="Administra tus cuentas y tarjetas"
          leading={<IconBadge name="wallet" variant="primary" />}
          onPress={() => navigation.navigate('Accounts')}
          accessibilityHint="Abre la administración de cuentas y tarjetas"
        />
        <ListItem
          testID="settings-categories"
          title="Categorías"
          subtitle="Organiza tus gastos e ingresos"
          leading={<IconBadge name="category" variant="primary" />}
          onPress={() => navigation.navigate('Categories')}
          accessibilityHint="Abre la administración de categorías"
        />
        <ListItem
          testID="settings-budgets"
          title="Presupuestos"
          subtitle="Define límites mensuales de gasto"
          leading={<IconBadge name="chart" variant="primary" />}
          onPress={() => navigation.navigate('Budgets')}
          accessibilityHint="Abre la administración de presupuestos"
        />
      </Card>
      <AppText variant="caption" color="textSecondary">
        Las demás preferencias de la aplicación estarán disponibles en una
        próxima fase.
      </AppText>
    </Screen>
  );
}
