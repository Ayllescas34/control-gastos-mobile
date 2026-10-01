import type { IsoDateTime } from '../../domain';

/** Current UTC instant in the persisted format: YYYY-MM-DDTHH:mm:ss.sssZ. */
export function nowIsoDateTime(): IsoDateTime {
  return new Date().toISOString();
}
