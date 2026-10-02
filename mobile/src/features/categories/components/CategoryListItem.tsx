import { ListItem } from '../../../shared/components';
import { IconBadge } from '../../../shared/icons';
import type { Category } from '../domain/types';
import { CATEGORY_KIND_VISUALS, categoryIconName } from './categoryVisuals';

type CategoryListItemProps = {
  category: Category;
  onPress: (categoryId: string) => void;
};

/** A category in a list: its icon tinted by kind and its name. */
export function CategoryListItem({ category, onPress }: CategoryListItemProps) {
  const kind = CATEGORY_KIND_VISUALS[category.kind];

  return (
    <ListItem
      testID={`category-${category.id}`}
      title={category.name}
      subtitle={kind.label}
      leading={
        <IconBadge name={categoryIconName(category.icon)} variant={kind.tone} />
      }
      onPress={() => onPress(category.id)}
      accessibilityHint="Abre la categoría para editarla o archivarla"
    />
  );
}
