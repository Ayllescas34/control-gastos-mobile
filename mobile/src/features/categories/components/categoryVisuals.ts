import type { IconName, IconTone } from '../../../shared/icons';
import type { CategoryIcon, CategoryKind } from '../domain/types';

/** Category icons are icon-system names; this keeps that guarantee in the type system. */
export function categoryIconName(icon: CategoryIcon): IconName {
  return icon;
}

/** Spoken/visible name of each icon, for the icon picker (screen readers included). */
export const CATEGORY_ICON_LABELS: Record<CategoryIcon, string> = {
  restaurant: 'Restaurante',
  coffee: 'Café',
  shoppingCart: 'Supermercado',
  shoppingBag: 'Compras',
  car: 'Transporte',
  travel: 'Viajes',
  home: 'Vivienda',
  utilities: 'Servicios',
  subscription: 'Suscripciones',
  health: 'Salud',
  education: 'Educación',
  entertainment: 'Entretenimiento',
  receipt: 'Recibo',
  creditCard: 'Tarjeta',
  cash: 'Efectivo',
  wallet: 'Billetera',
  bank: 'Banco',
  salary: 'Salario',
  other: 'Otros',
};

export const CATEGORY_KIND_VISUALS: Record<
  CategoryKind,
  { label: string; plural: string; tone: IconTone }
> = {
  expense: { label: 'Gasto', plural: 'Gastos', tone: 'expense' },
  income: { label: 'Ingreso', plural: 'Ingresos', tone: 'income' },
};

export const CATEGORY_KIND_OPTIONS = (
  Object.keys(CATEGORY_KIND_VISUALS) as CategoryKind[]
).map(kind => ({ value: kind, label: CATEGORY_KIND_VISUALS[kind].label }));
