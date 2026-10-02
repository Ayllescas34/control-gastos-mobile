import type { IconName } from '../../../shared/icons';
import {
  ACCOUNT_TYPES,
  CARD_NETWORKS,
  type AccountType,
  type CardNetwork,
} from '../domain/types';

/** Spanish label and icon per account type. The stored value is always the domain type. */
export const ACCOUNT_TYPE_VISUALS: Record<
  AccountType,
  { label: string; icon: IconName }
> = {
  cash: { label: 'Efectivo', icon: 'cash' },
  bank: { label: 'Banco', icon: 'bank' },
  savings: { label: 'Ahorros', icon: 'wallet' },
  credit_card: { label: 'Crédito', icon: 'creditCard' },
  other: { label: 'Otro', icon: 'wallet' },
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map(type => ({
  value: type,
  label: ACCOUNT_TYPE_VISUALS[type].label,
  icon: ACCOUNT_TYPE_VISUALS[type].icon,
}));

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  other: 'Otra',
};

/** ChoiceGroup values are strings, so "no network" (null in the domain) has a sentinel. */
export const NO_NETWORK = 'none';
export type CardNetworkChoice = CardNetwork | typeof NO_NETWORK;

export const CARD_NETWORK_OPTIONS: readonly {
  value: CardNetworkChoice;
  label: string;
}[] = [
  ...CARD_NETWORKS.map(network => ({
    value: network,
    label: CARD_NETWORK_LABELS[network],
  })),
  { value: NO_NETWORK, label: 'Sin especificar' },
];

export function cardNetworkLabel(network: CardNetwork | null): string {
  return network === null
    ? 'Red no especificada'
    : CARD_NETWORK_LABELS[network];
}

/** Credit vs debit is not stored on the card: it follows the account type (domain rule 11). */
export function cardKindLabel(accountType: AccountType): string {
  return accountType === 'credit_card'
    ? 'Tarjeta de crédito'
    : 'Tarjeta de débito';
}

/** Only the last four digits are ever shown (and stored). */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`;
}
