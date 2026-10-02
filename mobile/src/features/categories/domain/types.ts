import type { EntityId, Timestamps } from '../../../shared/domain';

/** What a category classifies: expenses or income. Transfers never have a category. */
export const CATEGORY_KINDS = ['expense', 'income'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/**
 * Icons a category may use: semantic names of the app's icon system, kept here as plain
 * strings so the domain does not depend on UI code (a test checks they all exist).
 */
export const CATEGORY_ICONS = [
  'restaurant',
  'coffee',
  'shoppingCart',
  'shoppingBag',
  'car',
  'travel',
  'home',
  'utilities',
  'subscription',
  'health',
  'education',
  'entertainment',
  'receipt',
  'creditCard',
  'cash',
  'wallet',
  'bank',
  'salary',
  'other',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** Classifies income and expense transactions. Archived (deletedAt) ones stay referenced. */
export type Category = Timestamps & {
  id: EntityId;
  name: string;
  kind: CategoryKind;
  icon: CategoryIcon;
};
