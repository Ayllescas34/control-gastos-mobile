import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  SectionHeader,
} from '../../../shared/components';
import { describeCategoriesError } from '../components/categoryMessages';
import { CategoryListItem } from '../components/CategoryListItem';
import { CATEGORY_KIND_VISUALS } from '../components/categoryVisuals';
import { CATEGORY_KINDS } from '../domain/types';
import { useCategories } from '../hooks/categoryHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

/** Active categories from SQLite, grouped by kind. Defaults come from a data migration. */
export function CategoriesScreen({ navigation }: Props) {
  const { resource, reload } = useCategories();

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando categorías" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudieron cargar tus categorías"
        message={describeCategoriesError(resource.error)}
      >
        <Button testID="categories-retry" title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  const categories = resource.data;
  if (categories.length === 0) {
    return (
      <EmptyState
        icon="category"
        title="No tienes categorías"
        message="Crea categorías para clasificar tus gastos e ingresos."
      >
        <Button
          testID="categories-empty-add"
          title="Agregar categoría"
          onPress={() => navigation.navigate('CategoryForm')}
        />
      </EmptyState>
    );
  }

  const open = (categoryId: string) =>
    navigation.navigate('CategoryForm', { categoryId });

  return (
    <Screen>
      {CATEGORY_KINDS.map(kind => {
        const visual = CATEGORY_KIND_VISUALS[kind];
        const ofKind = categories.filter(category => category.kind === kind);
        return [
          <SectionHeader
            key={`${kind}-header`}
            title={visual.plural}
            action={{
              testID: `categories-add-${kind}`,
              label: 'Agregar',
              icon: 'add',
              accessibilityHint: `Agrega una categoría de ${visual.plural.toLowerCase()}`,
              onPress: () => navigation.navigate('CategoryForm', { kind }),
            }}
          />,
          <Card key={`${kind}-list`}>
            {ofKind.length === 0 ? (
              <AppText color="textSecondary">
                No tienes categorías de {visual.plural.toLowerCase()}.
              </AppText>
            ) : (
              ofKind.map(category => (
                <CategoryListItem
                  key={category.id}
                  category={category}
                  onPress={open}
                />
              ))
            )}
          </Card>,
        ];
      })}
    </Screen>
  );
}
