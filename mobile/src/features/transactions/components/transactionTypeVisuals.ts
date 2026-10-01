import type { IconName, IconTone } from '../../../shared/icons';
import type { ColorName } from '../../../shared/theme';
import type { TransactionType } from '../domain/types';

type TransactionTypeVisual = {
  label: string;
  /** Prefix for the amount: income adds, expense subtracts, a transfer only moves money. */
  sign: string;
  amountColor: ColorName;
  icon: IconName;
  tone: IconTone;
};

/** Presentation of each transaction type. Money comes in (down), goes out (up), or moves. */
export const TRANSACTION_TYPE_VISUALS: Record<
  TransactionType,
  TransactionTypeVisual
> = {
  income: {
    label: 'Ingreso',
    sign: '+',
    amountColor: 'income',
    icon: 'arrowDown',
    tone: 'income',
  },
  expense: {
    label: 'Gasto',
    sign: '−',
    amountColor: 'expense',
    icon: 'arrowUp',
    tone: 'expense',
  },
  transfer: {
    label: 'Transferencia',
    sign: '',
    amountColor: 'textSecondary',
    icon: 'arrowLeftRight',
    tone: 'transfer',
  },
};
