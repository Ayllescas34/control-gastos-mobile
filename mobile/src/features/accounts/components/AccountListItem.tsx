import { AppText, ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatMoney } from '../../../shared/lib/money';
import type { Account } from '../domain/types';
import { ACCOUNT_TYPE_VISUALS } from './accountVisuals';

type AccountListItemProps = {
  account: Account;
  onPress: (accountId: string) => void;
};

/**
 * An account in a list: type icon, name, type and currency, and its initial balance (the
 * only persisted amount until real transactions exist).
 */
export function AccountListItem({ account, onPress }: AccountListItemProps) {
  const visual = ACCOUNT_TYPE_VISUALS[account.type];
  const balance = formatMoney(account.initialBalanceMinor, account.currency);

  return (
    <ListItem
      testID={`account-${account.id}`}
      title={account.name}
      subtitle={`${visual.label} · ${account.currency}`}
      leading={<IconBadge name={visual.icon} variant="primary" />}
      trailing={<AppText variant="amount">{balance}</AppText>}
      onPress={() => onPress(account.id)}
      accessibilityLabel={`${account.name}, ${visual.label}, saldo inicial ${balance}`}
      accessibilityHint="Abre el detalle de la cuenta"
    />
  );
}
