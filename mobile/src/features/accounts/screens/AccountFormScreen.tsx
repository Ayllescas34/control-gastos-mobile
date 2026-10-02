import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import type { RootStackParamList } from '../../../app/navigation/types';
import { appConfig } from '../../../core/config/appConfig';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { AccountForm } from '../components/AccountForm';
import {
  accountToFormValues,
  EMPTY_ACCOUNT_FORM,
} from '../components/accountFormModel';
import { describeAccountsError } from '../components/accountMessages';
import { EntityNotAvailableError } from '../domain/accountErrors';
import { useAccountDetail } from '../hooks/accountQueries';
import { useAccountRepositories } from '../hooks/useAccountRepositories';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountForm'>;

/** Creates an account, or edits one when `accountId` is given. Back on save. */
export function AccountFormScreen({ navigation, route }: Props) {
  const accountId = route.params?.accountId;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: accountId ? 'Editar cuenta' : 'Nueva cuenta',
    });
  }, [navigation, accountId]);

  return accountId ? (
    <EditAccount accountId={accountId} onSaved={() => navigation.goBack()} />
  ) : (
    <CreateAccount onSaved={() => navigation.goBack()} />
  );
}

function CreateAccount({ onSaved }: { onSaved: () => void }) {
  const repositories = useAccountRepositories();

  return (
    <Screen>
      <AccountForm
        initialValues={EMPTY_ACCOUNT_FORM}
        // No multi-currency yet: new accounts use the app currency.
        currency={appConfig.defaultCurrency}
        currencyHint="Por ahora las cuentas nuevas usan quetzales (GTQ)."
        submitLabel="Crear cuenta"
        onSubmit={async input => {
          await repositories.accounts.create(input);
          onSaved();
        }}
      />
    </Screen>
  );
}

function EditAccount({
  accountId,
  onSaved,
}: {
  accountId: string;
  onSaved: () => void;
}) {
  const { resource, reload } = useAccountDetail(accountId);
  const repositories = useAccountRepositories();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando cuenta" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la cuenta"
        message={describeAccountsError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }
  if (resource.data === null) {
    return (
      <EmptyState
        icon="info"
        title="Cuenta no disponible"
        message="La cuenta no existe o fue archivada."
      />
    );
  }

  const { account } = resource.data;
  return (
    <Screen>
      <AccountForm
        initialValues={accountToFormValues(account)}
        currency={account.currency}
        currencyHint="La moneda de una cuenta no se puede cambiar."
        submitLabel="Guardar cambios"
        onSubmit={async input => {
          // Currency is not editable (domain rule 6): only these fields change.
          const updated = await repositories.accounts.update(account.id, {
            name: input.name,
            type: input.type,
            initialBalanceMinor: input.initialBalanceMinor,
          });
          if (!updated) {
            throw new EntityNotAvailableError('account');
          }
          onSaved();
        }}
      />
    </Screen>
  );
}
