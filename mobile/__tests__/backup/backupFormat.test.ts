import type { Database } from '../../src/core/db';
import { createTestDatabase } from '../../src/core/db/testing/createTestDatabase';
import {
  InvalidBackupError,
  MAX_BACKUP_BYTES,
  backupFileName,
  createBackupRepository,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  utf8ByteLength,
  type BackupFile,
  type BackupProblem,
} from '../../src/features/backup';
import {
  describeBackupProblem,
  describeRestoreError,
} from '../../src/features/backup/components/backupMessages';
import { seedBackupFixture } from '../../src/features/backup/testing/backupFixture';

const SCHEMA = 4;
let database: Database;
let valid: BackupFile;

beforeAll(async () => {
  database = await createTestDatabase();
  await seedBackupFixture(database);
  valid = await createBackupRepository(database).exportBackup();
});

afterAll(() => database.close());

/** A deep copy of the valid backup, changed by `edit`. */
function variant(edit: (backup: BackupFile) => void): string {
  const copy = JSON.parse(serializeBackup(valid)) as BackupFile;
  edit(copy);
  return JSON.stringify(copy);
}

/** The problems parseBackup() reports for `text` (fails if it accepts it). */
function problemsOf(text: string): BackupProblem[] {
  try {
    parseBackup(text, SCHEMA);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidBackupError);
    return (error as InvalidBackupError).problems;
  }
  throw new Error('Expected the backup to be rejected');
}

const codes = (text: string) => problemsOf(text).map(p => p.code);

const NEW_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

describe('a valid backup', () => {
  it('round-trips through JSON unchanged', () => {
    expect(parseBackup(serializeBackup(valid), SCHEMA)).toEqual(valid);
  });

  it('keeps accents, emoji, quotes and backslashes', () => {
    const backup = parseBackup(serializeBackup(valid), SCHEMA);
    expect(backup.data.accounts.map(a => a.name)).toContain(
      'Ahorros A ñandú 💰',
    );
    expect(
      backup.data.transactions.map(t => t.description).filter(Boolean),
    ).toEqual(['Cena "especial" con \\ y emoji 🍕']);
  });

  it('accepts two archived categories with the same name, and archived duplicates of active rows', () => {
    const text = variant(b => {
      const food = b.data.categories.find(c => c.name === 'Comida A')!;
      b.data.categories.push(
        { ...food, id: NEW_ID, deletedAt: food.createdAt },
        {
          ...food,
          id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
          deletedAt: food.createdAt,
        },
      );
    });
    expect(() => parseBackup(text, SCHEMA)).not.toThrow();
  });

  it('summarizes the counts, archived rows apart', () => {
    expect(summarizeBackup(valid).tables.transactions).toEqual({
      total: 7,
      archived: 1,
    });
  });

  it('suggests a dated file name', () => {
    expect(backupFileName('2026-10-09')).toBe(
      'control-gastos-2026-10-09.json',
    );
  });
});

describe('rejected before reading any row', () => {
  it('an empty file', () => {
    expect(codes('')).toEqual(['empty']);
    expect(codes('  \n ')).toEqual(['empty']);
  });

  it('a file over the size limit, without parsing it', () => {
    const parse = jest.spyOn(JSON, 'parse');
    expect(codes(' '.repeat(MAX_BACKUP_BYTES) + '{}')).toEqual(['too_large']);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it('deeply nested JSON, without parsing it', () => {
    expect(codes('['.repeat(100_000) + ']'.repeat(100_000))).toEqual([
      'too_deep',
    ]);
    expect(codes('{"a":{"b":{"c":{"d":{"e":1}}}}}')).toEqual(['too_deep']);
  });

  it('corrupt JSON', () => {
    expect(codes('{"format":')).toEqual(['not_json']);
    expect(codes(serializeBackup(valid).slice(0, -1))).toEqual(['not_json']);
  });

  it('another format', () => {
    expect(codes('{"format":"otra-app"}')).toEqual(['unknown_format']);
    expect(codes('[1,2,3]')).toEqual(['unknown_format']);
    expect(codes('"control-gastos-backup"')).toEqual(['unknown_format']);
  });

  it('an unknown format version', () => {
    expect(codes(variant(b => Object.assign(b, { formatVersion: 2 })))).toEqual(
      ['unsupported_version'],
    );
    expect(
      codes(variant(b => Object.assign(b, { formatVersion: '1' }))),
    ).toEqual(['unsupported_version']);
  });

  it('another database schema version', () => {
    expect(codes(variant(b => Object.assign(b, { schemaVersion: 3 })))).toEqual(
      ['schema_mismatch'],
    );
  });

  it('missing, extra or mistyped top-level keys and collections', () => {
    expect(
      codes(variant(b => delete (b as Partial<BackupFile>).exportedAt)),
    ).toEqual(['invalid_structure']);
    expect(codes(variant(b => Object.assign(b, { device: 'x' })))).toEqual([
      'invalid_structure',
    ]);
    expect(
      codes(variant(b => delete (b.data as Partial<BackupFile['data']>).budgets)),
    ).toEqual(['invalid_structure']);
    expect(codes(variant(b => Object.assign(b.data, { budgets: {} })))).toEqual(
      ['invalid_structure'],
    );
    expect(codes(variant(b => Object.assign(b, { exportedAt: 'ayer' })))).toEqual(
      ['invalid_structure'],
    );
  });
});

describe('rejected for a row field', () => {
  const firstProblem = (text: string) => problemsOf(text)[0];

  it('a missing field', () => {
    expect(
      firstProblem(
        variant(b => delete (b.data.accounts[0] as { name?: string }).name),
      ),
    ).toEqual({ code: 'invalid_field', table: 'accounts', index: 0, field: 'name' });
  });

  it('an unknown field', () => {
    expect(
      firstProblem(
        variant(b => Object.assign(b.data.cards[0], { cvv: '123' })),
      ),
    ).toMatchObject({ code: 'invalid_field', table: 'cards', field: 'cvv' });
  });

  it('a wrong type', () => {
    expect(
      firstProblem(
        variant(b =>
          Object.assign(b.data.transactions[0], { amountMinor: '900000' }),
        ),
      ),
    ).toMatchObject({ table: 'transactions', field: 'amountMinor' });
    expect(
      firstProblem(variant(b => Object.assign(b.data.transactions, { 0: 7 }))),
    ).toMatchObject({ code: 'invalid_field', table: 'transactions', index: 0 });
  });

  it.each([
    ['a decimal amount', 100.5],
    ['zero', 0],
    ['a negative amount', -100],
    ['an amount beyond 2^53 − 1', Number.MAX_SAFE_INTEGER + 1],
  ])('%s', (_, amountMinor) => {
    expect(
      firstProblem(
        variant(b => Object.assign(b.data.transactions[0], { amountMinor })),
      ),
    ).toMatchObject({ code: 'invalid_field', field: 'amountMinor' });
  });

  it('a decimal or unsafe initial balance (negative ones are debt and valid)', () => {
    expect(
      firstProblem(
        variant(b =>
          Object.assign(b.data.accounts[0], { initialBalanceMinor: 1.5 }),
        ),
      ),
    ).toMatchObject({ field: 'initialBalanceMinor' });
    expect(
      firstProblem(
        variant(b =>
          Object.assign(b.data.accounts[0], {
            initialBalanceMinor: -Number.MAX_SAFE_INTEGER - 1,
          }),
        ),
      ),
    ).toMatchObject({ field: 'initialBalanceMinor' });
  });

  it.each([
    ['transactions', 'status', 'done'],
    ['transactions', 'type', 'refund'],
    ['transactions', 'currency', 'gtq'],
    ['transactions', 'localDate', '2026-02-30'],
    ['transactions', 'occurredAt', '2026-10-09 10:00'],
    ['accounts', 'type', 'loan'],
    ['accounts', 'id', 'not-a-uuid'],
    ['categories', 'icon', 'rocket'],
    ['cards', 'last4', '4242424242424242'],
    ['savingsGoals', 'targetDate', '15/12/2026'],
    ['budgets', 'deletedAt', 'nunca'],
  ] as const)('%s.%s = %j', (table, field, value) => {
    expect(
      firstProblem(
        variant(b => Object.assign(b.data[table][0], { [field]: value })),
      ),
    ).toMatchObject({ code: 'invalid_field', table, field });
  });

  it('reports at most 20 problems', () => {
    const text = variant(b =>
      b.data.transactions.forEach(t => Object.assign(t, { amountMinor: 0.5 })),
    );
    const many = variant(b => {
      for (let i = 0; i < 30; i++) {
        b.data.transactions.push({ ...b.data.transactions[0], amountMinor: 0.5 });
      }
    });
    expect(problemsOf(text).length).toBeLessThanOrEqual(20);
    expect(problemsOf(many)).toHaveLength(20);
  });
});

describe('rejected for the rules between rows', () => {
  it('a duplicate id', () => {
    expect(
      problemsOf(
        variant(b => b.data.transactions.push({ ...b.data.transactions[0] })),
      ),
    ).toContainEqual({ code: 'duplicate_id', table: 'transactions', index: 7 });
  });

  it('a movement of an account that is not in the backup', () => {
    expect(
      problemsOf(
        variant(b =>
          Object.assign(b.data.transactions[0], { accountId: NEW_ID }),
        ),
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'broken_reference',
        table: 'transactions',
        rule: 'account_not_found',
      }),
    );
  });

  it('a movement with a card that is not in the backup', () => {
    const text = variant(b => {
      const withCard = b.data.transactions.find(t => t.cardId !== null)!;
      withCard.cardId = NEW_ID;
    });
    expect(problemsOf(text)).toContainEqual(
      expect.objectContaining({ code: 'broken_reference', rule: 'card_not_found' }),
    );
  });

  it('a card, budget or goal whose parent is missing', () => {
    expect(
      codes(variant(b => Object.assign(b.data.cards[0], { accountId: NEW_ID }))),
    ).toContain('broken_reference');
    expect(
      codes(
        variant(b => Object.assign(b.data.budgets[0], { categoryId: NEW_ID })),
      ),
    ).toContain('broken_reference');
    expect(
      codes(
        variant(b =>
          Object.assign(b.data.savingsGoals[0], { accountId: NEW_ID }),
        ),
      ),
    ).toContain('broken_reference');
  });

  it('two active budgets for the same category and currency', () => {
    const text = variant(b => {
      const active = b.data.budgets.find(x => x.deletedAt === null)!;
      b.data.budgets.push({ ...active, id: NEW_ID });
    });
    expect(codes(text)).toContain('duplicate_active');
  });

  it('two active goals on the same account', () => {
    const text = variant(b => {
      const active = b.data.savingsGoals.find(x => x.deletedAt === null)!;
      b.data.savingsGoals.push({ ...active, id: NEW_ID, name: 'Otra' });
    });
    expect(codes(text)).toContain('duplicate_active');
  });

  it('two active categories of a kind whose names differ only in case or accents', () => {
    const text = variant(b => {
      const food = b.data.categories.find(c => c.name === 'Comida A')!;
      b.data.categories.push({ ...food, id: NEW_ID, name: 'CÓMIDA a' });
    });
    expect(codes(text)).toContain('duplicate_active');
  });

  it('a movement in another currency than its account', () => {
    const text = variant(b =>
      Object.assign(b.data.transactions[0], { currency: 'USD' }),
    );
    expect(problemsOf(text)).toContainEqual(
      expect.objectContaining({
        code: 'rule_violation',
        rule: 'currency_mismatch',
      }),
    );
  });

  it('a transfer with a category (the schema forbids it)', () => {
    const text = variant(b => {
      const transfer = b.data.transactions.find(t => t.type === 'transfer')!;
      transfer.categoryId = b.data.categories[0].id;
    });
    expect(problemsOf(text)).toContainEqual(
      expect.objectContaining({ rule: 'category_not_allowed_for_transfer' }),
    );
  });

  it('an active goal on a credit card or an archived account', () => {
    const onCard = variant(b => {
      const visa = b.data.accounts.find(a => a.type === 'credit_card')!;
      const goal = b.data.savingsGoals.find(g => g.deletedAt === null)!;
      goal.accountId = visa.id;
    });
    expect(problemsOf(onCard)).toContainEqual(
      expect.objectContaining({ rule: 'active_goal_on_credit_card' }),
    );
    const onArchived = variant(b => {
      const old = b.data.accounts.find(a => a.deletedAt !== null)!;
      const goal = b.data.savingsGoals.find(g => g.deletedAt === null)!;
      goal.accountId = old.id;
    });
    expect(problemsOf(onArchived)).toContainEqual(
      expect.objectContaining({ rule: 'active_goal_on_archived_account' }),
    );
  });

  it('an active card on an archived account', () => {
    const text = variant(b => {
      const old = b.data.accounts.find(a => a.deletedAt !== null)!;
      const card = b.data.cards.find(c => c.deletedAt === null)!;
      card.accountId = old.id;
      // Keep its movements consistent so only the card rule breaks.
      b.data.transactions = b.data.transactions.filter(
        t => t.cardId !== card.id,
      );
    });
    expect(problemsOf(text)).toContainEqual(
      expect.objectContaining({ rule: 'active_card_on_archived_account' }),
    );
  });
});

describe('messages', () => {
  it('explain each problem without showing file values and say nothing changed', () => {
    expect(describeBackupProblem({ code: 'unknown_format' })).toBe(
      'El archivo no es un respaldo de Control de Gastos.',
    );
    expect(
      describeBackupProblem({
        code: 'invalid_field',
        table: 'transactions',
        index: 2,
        field: 'amountMinor',
      }),
    ).toBe(
      'El respaldo tiene un dato faltante o no válido (Movimientos, registro 3), campo "amountMinor".',
    );
    expect(
      describeRestoreError(
        new InvalidBackupError([
          { code: 'duplicate_id', table: 'cards', index: 0 },
          { code: 'duplicate_id', table: 'cards', index: 1 },
        ]),
      ),
    ).toBe(
      'El respaldo tiene registros repetidos (Tarjetas, registro 1). Hay 1 problema más. Tus datos actuales no cambiaron.',
    );
  });
});

describe('utf8ByteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('ñ')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('💰')).toBe(4);
  });
});
