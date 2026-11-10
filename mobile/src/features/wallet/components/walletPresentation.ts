import { GOOGLE_WALLET_PACKAGE } from '../../../core/native/walletCaptures';
import type { IconName, IconTone } from '../../../shared/icons';
import { formatLocalDate, toLocalDate } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/money';
import type { ColorName } from '../../../shared/theme';
import type { WalletConnection } from '../data/syncWallet';
import type { CaptureKind, WalletCapture } from '../domain/types';

export const CONNECTION_COPY: Record<
  WalletConnection,
  { title: string; message: string }
> = {
  connected: {
    title: 'Captura automática activa',
    message:
      'Tus pagos con Google Wallet y los SMS de tu banco se registran aquí solos.',
  },
  disconnected: {
    title: 'Activa la captura automática',
    message:
      'Da acceso a notificaciones para registrar solos tus pagos con Google Wallet y los SMS de tu banco.',
  },
  unsupported: {
    title: 'Captura automática no disponible',
    message: 'La lectura de Google Wallet y de SMS del banco solo funciona en Android.',
  },
};

const KIND_VISUALS: Record<
  CaptureKind,
  { icon: IconName; tone: IconTone; color: ColorName; sign: string; fallback: string }
> = {
  expense: {
    icon: 'arrowUp',
    tone: 'expense',
    color: 'expense',
    sign: '−',
    fallback: 'Pago',
  },
  income: {
    icon: 'arrowDown',
    tone: 'income',
    color: 'income',
    sign: '+',
    fallback: 'Ingreso',
  },
  withdrawal: {
    icon: 'cash',
    tone: 'transfer',
    color: 'transfer',
    sign: '',
    fallback: 'Retiro de efectivo',
  },
};

/** Row text and visuals of a capture waiting for review. */
export function describeCapture(capture: WalletCapture) {
  const visual = KIND_VISUALS[capture.kind];
  const fromWallet = capture.sourceApp === GOOGLE_WALLET_PACKAGE;
  const amount = `${visual.sign}${formatMoney(
    capture.amountMinor,
    capture.currency,
  )}`;
  const date = formatLocalDate(
    toLocalDate(new Date(capture.postedAt)),
    "d 'de' MMM",
  );
  const where = capture.cardLast4
    ? `•••• ${capture.cardLast4}`
    : capture.accountLabel
    ? `Cuenta ${capture.accountLabel}`
    : 'Sin cuenta';
  const title =
    capture.kind === 'withdrawal'
      ? visual.fallback
      : capture.merchant ?? (fromWallet ? 'Pago con Google Wallet' : visual.fallback);
  const source = fromWallet ? 'Google Wallet' : 'SMS del banco';
  return {
    title,
    amount,
    icon: visual.icon,
    tone: visual.tone,
    amountColor: visual.color,
    subtitle: `${where} · ${date} · ${source}`,
    origin: fromWallet ? 'Pago capturado de Google Wallet' : 'Capturado de un SMS del banco',
    accessibilityLabel: `${title}, ${amount}, ${where}, ${date}, ${source}`,
  };
}
