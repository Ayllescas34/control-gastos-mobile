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
      </Card>
      <AppText variant="caption" color="textSecondary">
        Las demás preferencias de la aplicación estarán disponibles en una
        próxima fase.
      </AppText>
    </Screen>
  );
}
