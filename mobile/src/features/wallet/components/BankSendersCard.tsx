import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  getBankSenders,
  normalizeBankSenders,
  setBankSenders,
} from '../../../core/native/walletCaptures';
import {
  AppText,
  Button,
  Card,
  ListItem,
  TextField,
} from '../../../shared/components';
import { IconBadge, IconButton } from '../../../shared/icons';
import { spacing } from '../../../shared/theme';

/**
 * Which bank SMS the app reads: the sender number ("2424") or the word the message starts
 * with ("BiMovil"). Messages from anyone else are discarded on the phone before being stored
 * (docs/bank-messages.md). Android only.
 */
export function BankSendersCard() {
  const [senders, setSenders] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    getBankSenders().then(
      list => active && setSenders(list),
      () => active && setSenders([]),
    );
    return () => {
      active = false;
    };
  }, []);

  async function save(next: string[]) {
    try {
      await setBankSenders(next);
      setSenders(normalizeBankSenders(next));
    } catch {
      Alert.alert('No se pudo guardar', 'Intenta de nuevo.');
    }
  }

  function add() {
    const [value] = normalizeBankSenders([draft]);
    if (value === undefined) {
      setError('Escribe el número o la primera palabra del SMS (2 a 30 caracteres).');
      return;
    }
    setError(undefined);
    setDraft('');
    save([...(senders ?? []), value]);
  }

  return (
    <Card style={styles.card}>
      <AppText variant="heading" accessibilityRole="header">
        Mensajes del banco
      </AppText>
      <AppText variant="caption" color="textSecondary">
        La app lee solo los SMS de estos remitentes. Escribe el número que envía
        el SMS (ej. 2424) o la primera palabra del mensaje (ej. BiMovil). Luego
        pon en cada cuenta su identificador (ej. TCREDITO) para que se registren
        solos.
      </AppText>

      {senders?.map(sender => (
        <ListItem
          key={sender}
          testID={`bank-sender-${sender}`}
          title={sender}
          leading={<IconBadge name="bell" variant="primary" size="sm" />}
          trailing={
            <IconButton
              icon="close"
              accessibilityLabel={`Quitar ${sender}`}
              onPress={() => {
                save(senders.filter(item => item !== sender));
              }}
            />
          }
        />
      ))}
      {senders?.length === 0 && (
        <AppText color="textSecondary">
          No hay remitentes: no se leerá ningún SMS.
        </AppText>
      )}

      <View style={styles.add}>
        <TextField
          testID="bank-sender-input"
          label="Agregar remitente o palabra"
          value={draft}
          onChangeText={text => {
            setDraft(text);
            setError(undefined);
          }}
          placeholder="Ej. 2424 o BiMovil"
          maxLength={30}
          error={error}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Button
          testID="bank-sender-add"
          title="Agregar"
          variant="secondary"
          onPress={add}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  add: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});
