import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { CardForm } from '../components/CardForm';
import { cardToFormValues, emptyCardForm } from '../components/cardFormModel';
import { describeAccountsError } from '../components/accountMessages';
import { EntityNotAvailableError } from '../domain/accountErrors';
import { useAccountsOverview, useCardDetail } from '../hooks/accountQueries';
import { useAccountRepositories } from '../hooks/useAccountRepositories';

type Props = NativeStackScreenProps<RootStackParamList, 'CardForm'>;

/** Creates a card (optionally for a preselected account) or edits one. Back on save. */
export function CardFormScreen({ navigation, route }: Props) {
  const cardId = route.params?.cardId;
  const accountId = route.params?.accountId ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: cardId ? 'Editar tarjeta' : 'Nueva tarjeta',
    });
  }, [navigation, cardId]);

  const onSaved = () => navigation.goBack();
  return cardId ? (
    <EditCard cardId={cardId} onSaved={onSaved} />
  ) : (
    <CreateCard
      accountId={accountId}
      onSaved={onSaved}
      onAddAccount={() => navigation.replace('AccountForm')}
    />
  );
}

function CreateCard({
  accountId,
  onSaved,
  onAddAccount,
}: {
  accountId: string | null;
  onSaved: () => void;
  onAddAccount: () => void;
}) {
  const { resource, reload } = useAccountsOverview();
  const repositories = useAccountRepositories();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando cuentas" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus cuentas"
        message={describeAccountsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const { accounts } = resource.data;
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="Primero crea una cuenta"
        message="Cada tarjeta pertenece a una cuenta: crédito para tarjetas de crédito o banco para tarjetas de débito."
      >
        <Button title="Agregar cuenta" onPress={onAddAccount} />
      </EmptyState>
    );
  }

  // Preselect the account the user came from, or the only one available.
  const preselected =
    accountId ?? (accounts.length === 1 ? accounts[0].id : null);

  return (
    <Screen>
      <CardForm
        initialValues={emptyCardForm(preselected)}
        accounts={accounts}
        submitLabel="Crear tarjeta"
        onSubmit={async input => {
          await repositories.cards.create(input);
          onSaved();
        }}
      />
    </Screen>
  );
}

function EditCard({
  cardId,
  onSaved,
}: {
  cardId: string;
  onSaved: () => void;
}) {
  const { resource, reload } = useCardDetail(cardId);
  const repositories = useAccountRepositories();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando tarjeta" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la tarjeta"
        message={describeAccountsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }
  if (resource.data === null || resource.data.account === null) {
    return (
      <EmptyState
        icon="info"
        title="Tarjeta no disponible"
        message="La tarjeta o su cuenta no existen o fueron archivadas."
      />
    );
  }

  const { card, account } = resource.data;
  return (
    <Screen>
      <CardForm
        initialValues={cardToFormValues(card)}
        accounts={[account]}
        lockedAccount={account}
        submitLabel="Guardar cambios"
        onSubmit={async input => {
          // The account is fixed: only the card's own fields change.
          const updated = await repositories.cards.update(card.id, {
            alias: input.alias,
            last4: input.last4,
            network: input.network,
          });
          if (!updated) {
            throw new EntityNotAvailableError('card');
          }
          onSaved();
        }}
      />
    </Screen>
  );
}
