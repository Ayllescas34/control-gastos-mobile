import { AppText, ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import { formatMoney, type MinorUnits } from '../../../shared/lib/money';
import type { Account } from '../domain/types';
import { ACCOUNT_TYPE_VISUALS } from './accountVisuals';

type AccountListItemProps = {
  account: Account;
  /** Current balance (initial balance plus movements). */
  balanceMinor: MinorUnits;
  onPress: (accountId: string) => void;
};

/** An account in a list: type icon, name, type and currency, and its current balance. */
export function AccountListItem({
  account,
  balanceMinor,
  onPress,
}: AccountListItemProps) {
  const visual = ACCOUNT_TYPE_VISUALS[account.type];
  const balance = formatMoney(balanceMinor, account.currency);

  return (
    <ListItem
      testID={`account-${account.id}`}
      title={account.name}
      subtitle={`${visual.label} · ${account.currency}`}
      leading={<IconBadge name={visual.icon} variant="primary" />}
      trailing={<AppText variant="amount">{balance}</AppText>}
      onPress={() => onPress(account.id)}
      accessibilityLabel={`${account.name}, ${visual.label}, saldo ${balance}`}
      accessibilityHint="Abre el detalle de la cuenta"
    />
  );
}
