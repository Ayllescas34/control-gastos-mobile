import type { Transaction } from '../domain/types';

/**
 * DEMO DATA ONLY. Placeholder content for the initial visual base.
 * Remove once transactions are read from local persistence.
 */
const demoTransaction = (
  fields: Pick<
    Transaction,
    'id' | 'type' | 'amountMinor' | 'occurredAt' | 'localDate' | 'description'
  > &
    Partial<Transaction>,
): Transaction => ({
  currency: 'GTQ',
  accountId: 'demo-account-bank',
  toAccountId: null,
  categoryId: null,
  cardId: null,
  payee: null,
  note: null,
  source: 'manual',
  status: 'confirmed',
  externalRef: null,
  createdAt: fields.occurredAt,
  updatedAt: fields.occurredAt,
  deletedAt: null,
  ...fields,
});

export const DEMO_TRANSACTIONS: readonly Transaction[] = [
  demoTransaction({
    id: 'demo-1',
    type: 'expense',
    amountMinor: 45075,
    occurredAt: '2026-09-28T19:30:00.000Z',
    localDate: '2026-09-28',
    description: 'Supermercado',
    payee: 'Supermercado (demo)',
    cardId: 'demo-card-debit',
  }),
  demoTransaction({
    id: 'demo-2',
    type: 'income',
    amountMinor: 1250000,
    occurredAt: '2026-09-25T15:00:00.000Z',
    localDate: '2026-09-25',
    description: 'Salario',
  }),
  demoTransaction({
    id: 'demo-3',
    type: 'expense',
    amountMinor: 30000,
    occurredAt: '2026-09-24T22:10:00.000Z',
    localDate: '2026-09-24',
    description: 'Gasolina',
    accountId: 'demo-account-credit',
    cardId: 'demo-card-credit',
  }),
  demoTransaction({
    id: 'demo-4',
    type: 'expense',
    amountMinor: 18550,
    occurredAt: '2026-09-22T02:45:00.000Z',
    localDate: '2026-09-21',
    description: 'Restaurante',
    note: 'Cena de ejemplo',
  }),
  demoTransaction({
    id: 'demo-5',
    type: 'transfer',
    amountMinor: 150000,
    occurredAt: '2026-09-20T17:00:00.000Z',
    localDate: '2026-09-20',
    description: 'Pago de tarjeta de crédito',
    toAccountId: 'demo-account-credit',
  }),
];

export function findDemoTransaction(id: string): Transaction | undefined {
  return DEMO_TRANSACTIONS.find(transaction => transaction.id === id);
}
