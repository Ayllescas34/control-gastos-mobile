import type { InitialState } from '@react-navigation/native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import type { Database } from '../../src/core/db';
import { createGatedTestDatabase } from '../../src/core/db/testing/createGatedTestDatabase';
import { createCategoryRepository } from '../../src/features/categories';
import {
  chooseAlertButton,
  spyOnAlerts,
} from '../../src/shared/testing/alerts';
import {
  canPress,
  flushAsync,
  hasText,
  inputValue,
  pressByTestId,
  typeByTestId,
} from '../../src/shared/testing/testRenderer';

let database: Database;
let gatedDatabase: Database;
let releaseQueries: () => void;
let databaseClosed: boolean;
let renderer: Renderer | null;

beforeEach(async () => {
  ({
    database,
    gated: gatedDatabase,
    release: releaseQueries,
  } = await createGatedTestDatabase());
  databaseClosed = false;
  renderer = null;
});

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await ReactTestRenderer.act(async () => {
      mounted.unmount();
    });
  }
  releaseQueries();
  await flushAsync();
  if (!databaseClosed) {
    await database.close();
  }
  jest.restoreAllMocks();
});

async function open(state: InitialState, db: Database = database) {
  renderer = await renderRootStack(db, state);
  await flushAsync();
  return renderer;
}

const repository = () => createCategoryRepository(database.db);

const CATEGORIES: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'Categories' }],
};

async function categoryNamed(name: string) {
  const category = (await repository().list()).find(c => c.name === name);
  if (!category) {
    throw new Error(`No category "${name}"`);
  }
  return category;
}

describe('CategoriesScreen', () => {
  it('is reached from Settings', async () => {
    const view = await open({
      routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Settings' }] } }],
    });

    await pressByTestId(view.root, 'settings-categories');

    expect(hasText(view, 'Gastos')).toBe(true);
    expect(hasText(view, 'Supermercado')).toBe(true);
  });

  it('shows a loading state until SQLite answers', async () => {
    const view = await open(CATEGORIES, gatedDatabase);
    expect(
      view.root.findAll(
        node => node.props.accessibilityLabel === 'Cargando categorías',
      ).length,
    ).toBeGreaterThan(0);

    releaseQueries();
    await flushAsync();
    expect(hasText(view, 'Alimentación')).toBe(true);
  });

  it('lists the active categories grouped by kind', async () => {
    const view = await open(CATEGORIES);

    expect(hasText(view, 'Gastos')).toBe(true);
    expect(hasText(view, 'Ingresos')).toBe(true);
    expect(hasText(view, 'Salario')).toBe(true);
    expect(hasText(view, 'Suscripciones')).toBe(true);
  });

  it('shows an empty state when every category is archived', async () => {
    for (const category of await repository().list()) {
      await repository().softDelete(category.id);
    }

    const view = await open(CATEGORIES);

    expect(hasText(view, 'No tienes categorías')).toBe(true);
    expect(canPress(view.root, 'categories-empty-add')).toBe(true);
  });

  it('shows an error with a retry action when reading fails', async () => {
    databaseClosed = true;
    await database.close();

    const view = await open(CATEGORIES);

    expect(hasText(view, 'No se pudieron cargar tus categorías')).toBe(true);
    expect(canPress(view.root, 'categories-retry')).toBe(true);
  });
});

describe('category form', () => {
  it('validates before saving, including duplicate names', async () => {
    const view = await open(CATEGORIES);
    await pressByTestId(view.root, 'categories-add-expense');

    await pressByTestId(view.root, 'category-submit');
    expect(hasText(view, 'Escribe un nombre para la categoría.')).toBe(true);
    expect(hasText(view, 'Elige un icono.')).toBe(true);

    await typeByTestId(view.root, 'category-name', ' supermercado ');
    await pressByTestId(view.root, 'category-icon-other');
    await pressByTestId(view.root, 'category-submit');
    expect(hasText(view, 'Ya tienes una categoría con ese nombre.')).toBe(true);
    expect(await repository().list()).toHaveLength(14);
  });

  it('creates a category of the section it was opened from', async () => {
    const view = await open(CATEGORIES);
    await pressByTestId(view.root, 'categories-add-income');

    await typeByTestId(view.root, 'category-name', 'Freelance');
    await pressByTestId(view.root, 'category-icon-salary');
    await pressByTestId(view.root, 'category-submit');

    expect(await repository().list({ kind: 'income' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Freelance',
          kind: 'income',
          icon: 'salary',
        }),
      ]),
    );
    expect(hasText(view, 'Freelance')).toBe(true);
  });

  it('edits a category; its kind is fixed', async () => {
    const travel = await categoryNamed('Viajes');
    const view = await open(CATEGORIES);

    await pressByTestId(view.root, `category-${travel.id}`);
    expect(inputValue(view.root, 'category-name')).toBe('Viajes');
    expect(inputValue(view.root, 'category-kind-locked')).toBe('Gasto');

    await typeByTestId(view.root, 'category-name', 'Viajes y vacaciones');
    await pressByTestId(view.root, 'category-submit');

    expect(await repository().getById(travel.id)).toMatchObject({
      name: 'Viajes y vacaciones',
      kind: 'expense',
    });
    expect(hasText(view, 'Viajes y vacaciones')).toBe(true);
  });

  it('archives after confirmation; it leaves the list and keeps its row', async () => {
    const travel = await categoryNamed('Viajes');
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open(CATEGORIES);

    await pressByTestId(view.root, `category-${travel.id}`);
    await pressByTestId(view.root, 'category-archive');
    expect(alert).toHaveBeenCalledWith(
      '¿Archivar categoría?',
      expect.stringContaining('conservan'),
      expect.any(Array),
    );
    await chooseAlertButton(lastButtons(), 'Archivar');

    expect(await repository().getById(travel.id)).toBeNull();
    expect(
      (await repository().list({ includeArchived: true })).map(c => c.id),
    ).toContain(travel.id);
    expect(hasText(view, 'Viajes')).toBe(false);
  });

  it('keeps the category when archiving is cancelled', async () => {
    const travel = await categoryNamed('Viajes');
    const { lastButtons } = spyOnAlerts();
    const view = await open(CATEGORIES);

    await pressByTestId(view.root, `category-${travel.id}`);
    await pressByTestId(view.root, 'category-archive');
    await chooseAlertButton(lastButtons(), 'Cancelar');

    expect(await repository().getById(travel.id)).not.toBeNull();
  });
});
