import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import {
  Button,
  EmptyState,
  LoadingState,
  Screen,
} from '../../../shared/components';
import { spacing } from '../../../shared/theme';
import { CategoryForm } from '../components/CategoryForm';
import {
  categoryToFormValues,
  emptyCategoryForm,
} from '../components/categoryFormModel';
import { describeCategoriesError } from '../components/categoryMessages';
import { CategoryNotAvailableError } from '../domain/categoryErrors';
import type { CategoryKind } from '../domain/types';
import {
  useCategories,
  useCategory,
  useCategoryRepository,
} from '../hooks/categoryHooks';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryForm'>;

/** Creates a category (optionally of a preselected kind) or edits and archives one. */
export function CategoryFormScreen({ navigation, route }: Props) {
  const categoryId = route.params?.categoryId;
  const kind = route.params?.kind ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: categoryId ? 'Editar categoría' : 'Nueva categoría',
    });
  }, [navigation, categoryId]);

  const onDone = () => navigation.goBack();
  return categoryId ? (
    <EditCategory categoryId={categoryId} onDone={onDone} />
  ) : (
    <CreateCategory kind={kind} onDone={onDone} />
  );
}

function CreateCategory({
  kind,
  onDone,
}: {
  kind: CategoryKind | null;
  onDone: () => void;
}) {
  const { resource, reload } = useCategories();
  const repository = useCategoryRepository();

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
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }

  return (
    <Screen>
      <CategoryForm
        initialValues={emptyCategoryForm(kind)}
        existing={resource.data}
        submitLabel="Crear categoría"
        onSubmit={async input => {
          await repository.create(input);
          onDone();
        }}
      />
    </Screen>
  );
}

function EditCategory({
  categoryId,
  onDone,
}: {
  categoryId: string;
  onDone: () => void;
}) {
  const { resource, reload } = useCategory(categoryId);
  const repository = useCategoryRepository();
  const [archiving, setArchiving] = useState(false);

  if (resource.status === 'loading') {
    return <LoadingState accessibilityLabel="Cargando categoría" />;
  }
  if (resource.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
        title="No se pudo cargar la categoría"
        message={describeCategoriesError(resource.error)}
      >
        <Button title="Reintentar" onPress={reload} />
      </EmptyState>
    );
  }
  if (resource.data === null) {
    return (
      <EmptyState
        icon="info"
        title="Categoría no disponible"
        message="La categoría no existe o fue archivada."
      >
        <Button title="Volver" onPress={onDone} />
      </EmptyState>
    );
  }

  const { category, all } = resource.data;

  async function archive() {
    setArchiving(true);
    try {
      await repository.softDelete(category.id);
      onDone();
    } catch (error) {
      console.error('Archive category failed', error);
      setArchiving(false);
      Alert.alert(
        'No se pudo archivar la categoría',
        describeCategoriesError(error),
      );
    }
  }

  function confirmArchive() {
    Alert.alert(
      '¿Archivar categoría?',
      `"${category.name}" dejará de aparecer al registrar movimientos. Los movimientos que ya la usan la conservan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: archive },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <CategoryForm
          initialValues={categoryToFormValues(category)}
          existing={all}
          editing={category}
          submitLabel="Guardar cambios"
          onSubmit={async input => {
            const updated = await repository.update(category.id, {
              name: input.name,
              icon: input.icon,
            });
            if (!updated) {
              throw new CategoryNotAvailableError();
            }
            onDone();
          }}
        />
        <Button
          testID="category-archive"
          title="Archivar categoría"
          variant="danger"
          loading={archiving}
          accessibilityHint="Pide confirmación antes de archivar"
          onPress={confirmArchive}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
});
