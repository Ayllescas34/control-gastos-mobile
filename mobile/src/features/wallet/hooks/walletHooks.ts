import { useCallback, useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import {
  useAsyncResource,
  useReloadOnFocus,
  useReloadOnForeground,
} from '../../../shared/hooks';
// By module, not the feature indexes, to keep features free of import cycles.
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';
import type { Transaction } from '../../transactions/domain/types';
import {
  loadReferences,
  useTransactionRepositories,
} from '../../transactions/hooks/transactionHooks';
import {
  readWalletConnection,
  syncWalletQuietly,
  type WalletConnection,
} from '../data/syncWallet';
import { createWalletCaptureRepository } from '../data/walletCaptureRepository';
import type { WalletCapture } from '../domain/types';

export function useWalletRepository() {
  const { db } = useDatabase();
  return useMemo(() => createWalletCaptureRepository(db), [db]);
}

export type WalletInboxData = {
  connection: WalletConnection;
  /** Payments that could not be matched to a card: waiting for an account. */
  captures: WalletCapture[];
  /** Movements registered automatically, waiting for the user's review. */
  pendingTransactions: Transaction[];
  references: ReferenceLookup;
};

/** Google Wallet screen: connection state plus everything waiting for review. */
export function useWalletInbox() {
  const database = useDatabase();
  const repositories = useTransactionRepositories();
  const captures = useWalletRepository();
  const load = useCallback(async (): Promise<WalletInboxData> => {
    await syncWalletQuietly(database);
    const [connection, newCaptures, pendingTransactions, references] =
      await Promise.all([
        readWalletConnection(),
        captures.listNew(),
        repositories.transactions.list({ status: 'pending' }),
        loadReferences(repositories),
      ]);
    return {
      connection,
      captures: newCaptures,
      pendingTransactions,
      references,
    };
  }, [database, repositories, captures]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  useReloadOnForeground(reload);
  return { resource, reload };
}

export type WalletSummary = {
  connection: WalletConnection;
  /** New captures plus movements pending review. */
  reviewCount: number;
};

/** Syncs and counts what waits for review; used by Inicio. */
export async function loadWalletSummary(
  database: ReturnType<typeof useDatabase>,
  repositories: ReturnType<typeof useTransactionRepositories>,
): Promise<WalletSummary> {
  await syncWalletQuietly(database);
  const [connection, captures, pending] = await Promise.all([
    readWalletConnection(),
    createWalletCaptureRepository(database.db).listNew(),
    repositories.transactions.list({ status: 'pending' }),
  ]);
  return { connection, reviewCount: captures.length + pending.length };
}

export type CapturePrefillData = {
  capture: WalletCapture;
  references: ReferenceLookup;
  /** Account (and card) the capture points to, by card digits or bank identifier. */
  match: { cardId: EntityId | null; accountId: EntityId } | null;
  /** Category of the merchant's latest movement of the same type, if any. */
  suggestedCategoryId: EntityId | null;
  /** Where a withdrawal's cash goes: the single cash account, if any. */
  cashAccountId: EntityId | null;
} | null;

/** What the "register this payment" form needs. Null when the capture is gone. */
export function useCapturePrefill(captureId: EntityId) {
  const repositories = useTransactionRepositories();
  const captures = useWalletRepository();
  const load = useCallback(async (): Promise<CapturePrefillData> => {
    const capture = await captures.getById(captureId);
    if (!capture || capture.status !== 'new') {
      return null;
    }
    const [references, match, suggestedCategoryId, cashAccountId] =
      await Promise.all([
        loadReferences(repositories),
        captures.target(capture),
        capture.kind === 'withdrawal'
          ? Promise.resolve(null)
          : captures.suggestCategory(capture.merchant, capture.kind),
        captures.cashAccount(capture.currency),
      ]);
    return { capture, references, match, suggestedCategoryId, cashAccountId };
  }, [captures, captureId, repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
