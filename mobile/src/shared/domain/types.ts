/** Opaque identifier of a domain entity. */
export type EntityId = string;

/** UTC instant, ISO 8601 (e.g. "2026-09-28T19:30:00.000Z"). */
export type IsoDateTime = string;

/** Civil date without time zone, "YYYY-MM-DD". */
export type LocalDate = string;

/** Audit timestamps shared by persisted entities. `deletedAt` marks a soft delete. */
export type Timestamps = {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};
