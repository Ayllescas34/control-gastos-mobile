import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { Button, EmptyState } from '../../../shared/components';

type Props = NativeStackScreenProps<RootStackParamList, 'NewTransaction'>;

/** Placeholder modal for the main action. The form comes in the transactions phase. */
export function NewTransactionScreen({ navigation }: Props) {
  return (
    <EmptyState
      icon="add"
      title="Nuevo movimiento"
      message="Aquí se registrarán gastos, ingresos y transferencias. Disponible en una próxima fase."
    >
      <Button title="Cerrar" onPress={() => navigation.goBack()} />
    </EmptyState>
  );
}
