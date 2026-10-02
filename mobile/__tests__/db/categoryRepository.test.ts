/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sql } from 'drizzle-orm';
import {
  createDatabase,
  prepareDatabase,
  type Database,
} from '../../src/core/db';
import { migrate } from '../../src/core/db/migrate';
import migrations from '../../src/core/db/migrations/migrations';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import { sqliteErrorMessage } from '../../src/core/db/testing/sqliteErrorMessage';
import {
  createCategoryRepository,
  InvalidCategoryError,
  type CategoryRepository,
} from '../../src/features/categories';

const NOW = '2026-10-01T12:00:00.000Z';

const DEFAULT_EXPENSES = [
  'Alimentación',
  'Compras',
  'Educación',
  'Entretenimiento',
  'Otros',
  'Salud',
  'Servicios',
  'Supermercado',
  'Suscripciones',
  'Transporte',
  'Viajes',
  'Vivienda',
];
const DEFAULT_INCOME = ['Otros ingresos', 'Salario'];

let database: Database;
let repository: CategoryRepository;

beforeEach(async () => {
  database = await createTestDatabase();
  repository = createCategoryRepository(database.db);
});

afterEach(() => database.close());

describe('default categories', () => {
  it('are created once by the data migration', async () => {
    const expense = await repository.list({ kind: 'expense' });
    const income = await repository.list({ kind: 'income' });

    expect(expense.map(c => c.name).sort()).toEqual(
      [...DEFAULT_EXPENSES].sort(),
    );
    expect(income.map(c => c.name).sort()).toEqual([...DEFAULT_INCOME].sort());
    expect(expense.find(c => c.name === 'Supermercado')?.icon).toBe(
      'shoppingCart',
    );
  });

  it('stay archived: running the migrations again does not bring them back', async () => {
    const [first] = await repository.list();
    await repository.softDelete(first.id);

    await migrate(database, migrations);

    expect(await repository.getById(first.id)).toBeNull();
    expect(await repository.list()).toHaveLength(13);
  });
});

describe('categoryRepository', () => {
  it('creates, reads and lists a category', async () => {
    const pets = await repository.create({
      name: 'Mascotas',
      kind: 'expense',
      icon: 'other',
    });

    expect(await repository.getById(pets.id)).toEqual(pets);
    expect(
      (await repository.list({ kind: 'expense' })).map(c => c.id),
    ).toContain(pets.id);
    expect(
      (await repository.list({ kind: 'income' })).map(c => c.id),
    ).not.toContain(pets.id);
  });

  it('rejects invalid categories before writing', async () => {
    await expect(
      repository.create({
        name: '  ',
        kind: 'expense',
        icon: 'rocket' as 'other',
      }),
    ).rejects.toMatchObject({ errors: ['name_required', 'icon_invalid'] });
    expect(await repository.list()).toHaveLength(14);
  });

  it('rejects a duplicate name of the same kind', async () => {
    await expect(
      repository.create({
        name: 'supermercado',
        kind: 'expense',
        icon: 'other',
      }),
    ).rejects.toBeInstanceOf(InvalidCategoryError);
    await expect(
      repository.create({
        name: ' SUPERMERCADO ',
        kind: 'expense',
        icon: 'other',
      }),
    ).rejects.toMatchObject({ errors: ['name_duplicate'] });
  });

  it('allows reusing the name of an archived category', async () => {
    const [travel] = (await repository.list()).filter(c => c.name === 'Viajes');
    await repository.softDelete(travel.id);

    const again = await repository.create({
      name: 'Viajes',
      kind: 'expense',
      icon: 'travel',
    });
    expect(again.id).not.toBe(travel.id);
  });

  it('updates name and icon; validates the result', async () => {
    const pets = await repository.create({
      name: 'Mascotas',
      kind: 'expense',
      icon: 'other',
    });

    expect(
      await repository.update(pets.id, { name: 'Mascota', icon: 'health' }),
    ).toMatchObject({ name: 'Mascota', icon: 'health', kind: 'expense' });
    // Keeping its own name is not a duplicate.
    expect(await repository.update(pets.id, { name: 'MASCOTA' })).toMatchObject(
      {
        name: 'MASCOTA',
      },
    );
    await expect(
      repository.update(pets.id, { name: 'Salud' }),
    ).rejects.toMatchObject({ errors: ['name_duplicate'] });
  });

  it('archives without deleting; archived ones leave normal lists', async () => {
    const pets = await repository.create({
      name: 'Mascotas',
      kind: 'expense',
      icon: 'other',
    });

    expect(await repository.softDelete(pets.id)).toBe(true);
    expect(await repository.softDelete(pets.id)).toBe(false);
    expect(await repository.getById(pets.id)).toBeNull();
    expect((await repository.list()).map(c => c.id)).not.toContain(pets.id);
    expect(
      (await repository.list({ includeArchived: true })).map(c => c.id),
    ).toContain(pets.id);
    expect(await repository.update(pets.id, { name: 'X' })).toBeNull();
  });
});

describe('the database is a second barrier', () => {
  it('rejects a duplicate active name per kind (unique index)', async () => {
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO categories VALUES ('dup', 'Supermercado', 'expense', 'other', ${NOW}, ${NOW}, NULL)`,
        ),
      ),
    ).toMatch(/UNIQUE constraint failed/);
  });

  it('rejects an unknown kind and a blank name', async () => {
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO categories VALUES ('k', 'X', 'transfer', 'other', ${NOW}, ${NOW}, NULL)`,
        ),
      ),
    ).toMatch(/categories_kind_check/);
    expect(
      await sqliteErrorMessage(
        database.db.run(
          sql`INSERT INTO categories VALUES ('n', '   ', 'expense', 'other', ${NOW}, ${NOW}, NULL)`,
        ),
      ),
    ).toMatch(/categories_name_check/);
  });

  it('keeps a transaction category valid (FK) and never deletes a used category', async () => {
    const [food] = await repository.list({ kind: 'expense' });
    await database.db.run(
      sql`INSERT INTO accounts VALUES ('a', 'A', 'bank', 'GTQ', 0, ${NOW}, ${NOW}, NULL)`,
    );
    const insertTx = (id: string, categoryId: string) =>
      database.db.run(sql`INSERT INTO transactions (
          id, type, amount_minor, currency, account_id, category_id,
          occurred_at, local_date, source, status, created_at, updated_at
        ) VALUES (${id}, 'expense', 100, 'GTQ', 'a', ${categoryId},
          ${NOW}, '2026-10-01', 'manual', 'confirmed', ${NOW}, ${NOW})`);

    expect(await sqliteErrorMessage(insertTx('t0', 'missing'))).toMatch(
      /FOREIGN KEY constraint failed/,
    );
    await insertTx('t1', food.id);
    expect(
      await sqliteErrorMessage(
        database.db.run(sql`DELETE FROM categories WHERE id = ${food.id}`),
      ),
    ).toMatch(/FOREIGN KEY constraint failed/);

    // Archiving is allowed and the transaction keeps its reference.
    await repository.softDelete(food.id);
    const [[categoryId]] = await database.db.values<[string]>(
      sql`SELECT category_id FROM transactions WHERE id = 't1'`,
    );
    expect(categoryId).toBe(food.id);
  });
});

describe('migration of an existing install', () => {
  it('adds categories and the FK while keeping existing transactions', async () => {
    const upgraded = createDatabase(createNodeSqliteExecutor());
    await upgraded.db.run(sql`PRAGMA foreign_keys = ON`);
    // The schema as shipped before categories, with data in it.
    await migrate(upgraded, {
      journal: { entries: migrations.journal.entries.slice(0, 1) },
      migrations: { m0000: migrations.migrations.m0000 },
    });
    await upgraded.db.run(
      sql`INSERT INTO accounts VALUES ('a', 'A', 'bank', 'GTQ', 0, ${NOW}, ${NOW}, NULL)`,
    );
    await upgraded.db.run(sql`INSERT INTO transactions (
        id, type, amount_minor, currency, account_id, occurred_at, local_date,
        source, status, created_at, updated_at
      ) VALUES ('t', 'expense', 4575, 'GTQ', 'a', ${NOW}, '2026-10-01',
        'manual', 'confirmed', ${NOW}, ${NOW})`);

    await migrate(upgraded, migrations);

    const [[amount]] = await upgraded.db.values<[number]>(
      sql`SELECT amount_minor FROM transactions WHERE id = 't'`,
    );
    expect(amount).toBe(4575);
    const [[leftovers]] = await upgraded.db.values<[number]>(
      sql`SELECT count(*) FROM sqlite_master WHERE sql LIKE '%__new_transactions%'`,
    );
    expect(leftovers).toBe(0);
    const [[foreignKeys]] = await upgraded.db.values<[number]>(
      sql`PRAGMA foreign_keys`,
    );
    expect(foreignKeys).toBe(1);
    // CHECKs of the rebuilt table still apply.
    expect(
      await sqliteErrorMessage(
        upgraded.db.run(sql`INSERT INTO transactions (
          id, type, amount_minor, currency, account_id, occurred_at, local_date,
          source, status, created_at, updated_at
        ) VALUES ('x', 'expense', 0, 'GTQ', 'a', ${NOW}, '2026-10-01',
          'manual', 'confirmed', ${NOW}, ${NOW})`),
      ),
    ).toMatch(/transactions_amount_minor_check/);
    expect(await createCategoryRepository(upgraded.db).list()).toHaveLength(14);
    await upgraded.close();
  });
});

describe('persistence', () => {
  it('reads back, from a new connection, a category written by an earlier one', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'control-gastos-'));
    const path = join(directory, 'control-gastos.db');
    const open = () =>
      prepareDatabase(
        createDatabase(createNodeSqliteExecutor(new DatabaseSync(path))),
      );
    try {
      const first = await open();
      const pets = await createCategoryRepository(first.db).create({
        name: 'Mascotas',
        kind: 'expense',
        icon: 'other',
      });
      await first.close();

      const second = await open();
      expect(
        await createCategoryRepository(second.db).getById(pets.id),
      ).toEqual(pets);
      // Defaults were seeded once, not again on reopening.
      expect(await createCategoryRepository(second.db).list()).toHaveLength(15);
      await second.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
