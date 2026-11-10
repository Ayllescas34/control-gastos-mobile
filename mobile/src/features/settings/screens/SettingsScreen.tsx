import { useNavigation } from '@react-navigation/native';
import { AppText, Card, ListItem, Screen } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';

export function SettingsScreen() {
  const navigation = useNavigation();

  return (
    <Screen>
      <Card>
        <ListItem
          testID="settings-wallet"
          title="Pagos automáticos"
          subtitle="Google Wallet y SMS de tu banco"
          leading={<IconBadge name="contactless" variant="primary" />}
          onPress={() => navigation.navigate('Wallet')}
          accessibilityHint="Abre la captura automática de pagos"
        />
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
        <ListItem
          testID="settings-savings"
          title="Metas de ahorro"
          subtitle="Sigue cuánto llevas ahorrado en tus cuentas"
          leading={<IconBadge name="wallet" variant="primary" />}
          onPress={() => navigation.navigate('SavingsGoals')}
          accessibilityHint="Abre la administración de metas de ahorro"
        />
        <ListItem
          testID="settings-security"
          title="Seguridad"
          subtitle="PIN de 6 dígitos para abrir la app"
          leading={<IconBadge name="lock" variant="primary" />}
          onPress={() => navigation.navigate('Security')}
          accessibilityHint="Abre el bloqueo con PIN"
        />
        <ListItem
          testID="settings-backup"
          title="Respaldo de datos"
          subtitle="Exporta o restaura todos tus datos"
          leading={<IconBadge name="backup" variant="primary" />}
          onPress={() => navigation.navigate('Backup')}
          accessibilityHint="Abre el respaldo y la restauración de datos"
        />
      </Card>
      <AppText variant="caption" color="textSecondary">
        Las demás preferencias de la aplicación estarán disponibles en una
        próxima fase.
      </AppText>
    </Screen>
  );
}
