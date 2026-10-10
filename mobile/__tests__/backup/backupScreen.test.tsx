import type { InitialState } from '@react-navigation/native';
import ReactTestRenderer, {
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { renderRootStack } from '../../src/app/testing/renderRootStack';
import { createDatabase, prepareDatabase, type Database } from '../../src/core/db';
import { createNodeSqliteExecutor } from '../../src/core/db/testing/nodeSqliteExecutor';
import {
  FileTransferError,
  openTextDocument,
  saveTextDocument,
} from '../../src/core/native/backupFiles';
import {
  createBackupRepository,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '../../src/features/backup';
import { seedBackupFixture } from '../../src/features/backup/testing/backupFixture';
import { todayLocalDate } from '../../src/shared/lib/dates';
import {
  chooseAlertButton,
  spyOnAlerts,
} from '../../src/shared/testing/alerts';
import {
  canPress,
  flushAsync,
  hasText,
  pressByTestId,
} from '../../src/shared/testing/testRenderer';

// The Android picker is native: the file transfer is simulated, SQLite is real.
jest.mock('../../src/core/native/backupFiles', () => ({
  ...jest.requireActual('../../src/core/native/backupFiles'),
  saveTextDocument: jest.fn(),
  openTextDocument: jest.fn(),
}));

const save = saveTextDocument as jest.MockedFunction<typeof saveTextDocument>;
const openFile = openTextDocument as jest.MockedFunction<
  typeof openTextDocument
>;

let databases: Database[];
let renderer: Renderer | null;

async function newDatabase(): Promise<Database> {
  const database = await prepareDatabase(
    createDatabase(createNodeSqliteExecutor()),
  );
  databases.push(database);
  return database;
}

beforeEach(() => {
  databases = [];
  renderer = null;
  save.mockReset();
  openFile.mockReset();
});

afterEach(async () => {
  if (renderer) {
    const mounted = renderer;
    await ReactTestRenderer.act(async () => {
      mounted.unmount();
    });
  }
  await flushAsync();
  await Promise.all(databases.map(database => database.close()));
  jest.restoreAllMocks();
});

const BACKUP_ROUTE: InitialState = {
  routes: [{ name: 'MainTabs' }, { name: 'Backup' }],
};

async function open(database: Database, state: InitialState = BACKUP_ROUTE) {
  renderer = await renderRootStack(database, state);
  await flushAsync();
  return renderer;
}

function noticeText(view: Renderer): string | undefined {
  return view.root.findAll(
    node => node.props.testID === 'backup-notice' && node.props.accessibilityLabel,
  )[0]?.props.accessibilityLabel;
}

async function snapshot(database: Database): Promise<BackupFile['data']> {
  return (await createBackupRepository(database).exportBackup()).data;
}

/** A source database exported as the JSON text a user would pick. */
async function backupText(label = 'A'): Promise<string> {
  const source = await newDatabase();
  await seedBackupFixture(source, label);
  return serializeBackup(await createBackupRepository(source).exportBackup());
}

function silenceErrors() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}

describe('Respaldo de datos', () => {
  it('opens from Configuración and explains what a backup holds', async () => {
    const database = await newDatabase();
    const view = await open(database, {
      routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Settings' }] } }],
    });

    await pressByTestId(view.root, 'settings-backup');

    expect(hasText(view, 'Exportar respaldo')).toBe(true);
    expect(hasText(view, 'Restaurar respaldo')).toBe(true);
    expect(hasText(view, 'también los archivados')).toBe(true);
    expect(hasText(view, 'El archivo no está cifrado')).toBe(true);
  });
});

describe('export', () => {
  it('saves every table as a dated JSON file that can be restored', async () => {
    const database = await newDatabase();
    await seedBackupFixture(database);
    save.mockResolvedValue('saved');
    const view = await open(database);

    await pressByTestId(view.root, 'backup-export');

    expect(save).toHaveBeenCalledTimes(1);
    const [fileName, content] = save.mock.calls[0];
    expect(fileName).toBe(`control-gastos-${todayLocalDate()}.json`);
    const backup = parseBackup(content, 4);
    expect(backup.data).toEqual(await snapshot(database));
    expect(noticeText(view)).toBe(
      'Respaldo guardado. Consérvalo en un lugar seguro: no está cifrado.',
    );
  });

  it('reports a cancelled picker without an error', async () => {
    const database = await newDatabase();
    save.mockResolvedValue('cancelled');
    const view = await open(database);

    await pressByTestId(view.root, 'backup-export');

    expect(noticeText(view)).toBe('Exportación cancelada.');
  });

  it('explains a write failure and logs no file content', async () => {
    const database = await newDatabase();
    await seedBackupFixture(database);
    save.mockRejectedValue(new FileTransferError('write_failed'));
    const consoleError = silenceErrors();
    const view = await open(database);

    await pressByTestId(view.root, 'backup-export');

    expect(noticeText(view)).toBe(
      'No se pudo guardar el archivo. Elige otra ubicación e inténtalo de nuevo.',
    );
    expect(consoleError).toHaveBeenCalledWith(
      'Backup export failed',
      'FileTransferError: write_failed',
    );
  });

  it('blocks both actions while exporting', async () => {
    const database = await newDatabase();
    let finish!: (value: 'saved') => void;
    save.mockImplementation(() => new Promise(resolve => (finish = resolve)));
    const view = await open(database);

    await pressByTestId(view.root, 'backup-export');
    expect(canPress(view.root, 'backup-export')).toBe(false);
    expect(canPress(view.root, 'backup-restore')).toBe(false);

    await ReactTestRenderer.act(async () => finish('saved'));
    await flushAsync();
    expect(canPress(view.root, 'backup-restore')).toBe(true);
  });
});

describe('restore', () => {
  it('shows the summary first and only replaces the data after both confirmations', async () => {
    const text = await backupText('A');
    const target = await newDatabase();
    await seedBackupFixture(target, 'B');
    openFile.mockResolvedValue({ status: 'opened', content: text });
    const { alert, lastButtons } = spyOnAlerts();
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');

    // Read and validated: nothing written yet.
    expect(openFile).toHaveBeenCalledWith(25 * 1024 * 1024);
    expect(hasText(view, 'El archivo es válido y contiene:')).toBe(true);
    expect(hasText(view, '7 (1 archivado)')).toBe(true);
    expect(hasText(view, '17 (1 archivado)')).toBe(true);
    expect(await snapshot(target)).toEqual(before);

    await pressByTestId(view.root, 'backup-confirm-restore');
    expect(alert).toHaveBeenLastCalledWith(
      '¿Sustituir todos tus datos?',
      expect.stringContaining('no se puede deshacer'),
      expect.any(Array),
    );
    expect(await snapshot(target)).toEqual(before);

    await chooseAlertButton(lastButtons(), 'Sustituir datos');

    const restored = await snapshot(target);
    expect(restored).toEqual(parseBackup(text, 4).data);
    expect(noticeText(view)).toBe(
      'Respaldo restaurado. Tus datos ahora son los del archivo.',
    );
  });

  it('shows the restored data when going back, without restarting the app', async () => {
    const text = await backupText('A');
    const target = await newDatabase();
    await seedBackupFixture(target, 'B');
    openFile.mockResolvedValue({ status: 'opened', content: text });
    const { lastButtons } = spyOnAlerts();
    const view = await open(target);

    await pressByTestId(view.root, 'backup-restore');
    await pressByTestId(view.root, 'backup-confirm-restore');
    await chooseAlertButton(lastButtons(), 'Sustituir datos');
    await pressByTestId(view.root, 'backup-go-home');

    // Inicio reloads on focus: its recent movements now come from the backup.
    expect(hasText(view, 'Movimientos recientes')).toBe(true);
    const shows = (label: string) =>
      ['Empresa', 'Restaurante'].some(payee => hasText(view, `${payee} ${label}`));
    expect(shows('A')).toBe(true);
    expect(shows('B')).toBe(false);
  });

  it('changes nothing when the summary is cancelled', async () => {
    const target = await newDatabase();
    await seedBackupFixture(target, 'B');
    openFile.mockResolvedValue({
      status: 'opened',
      content: await backupText('A'),
    });
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');
    await pressByTestId(view.root, 'backup-cancel-restore');

    expect(noticeText(view)).toBe(
      'Restauración cancelada. Tus datos no cambiaron.',
    );
    expect(hasText(view, 'El archivo es válido y contiene:')).toBe(false);
    expect(await snapshot(target)).toEqual(before);
  });

  it('changes nothing when the final confirmation is cancelled', async () => {
    const target = await newDatabase();
    await seedBackupFixture(target, 'B');
    openFile.mockResolvedValue({
      status: 'opened',
      content: await backupText('A'),
    });
    const { lastButtons } = spyOnAlerts();
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');
    await pressByTestId(view.root, 'backup-confirm-restore');
    await chooseAlertButton(lastButtons(), 'Cancelar');

    expect(await snapshot(target)).toEqual(before);
    expect(hasText(view, 'El archivo es válido y contiene:')).toBe(true);
  });

  it('changes nothing when no file is chosen', async () => {
    const target = await newDatabase();
    await seedBackupFixture(target);
    openFile.mockResolvedValue({ status: 'cancelled' });
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');

    expect(noticeText(view)).toBe(
      'No elegiste ningún archivo. Tus datos no cambiaron.',
    );
    expect(await snapshot(target)).toEqual(before);
  });

  it.each([
    ['an empty file', '', 'El archivo está vacío.'],
    ['corrupt JSON', '{"format":', 'El archivo no es un JSON válido.'],
    [
      'another app’s file',
      '{"format":"otra-app"}',
      'El archivo no es un respaldo de Control de Gastos.',
    ],
  ])('rejects %s without changing anything', async (_, content, message) => {
    const target = await newDatabase();
    await seedBackupFixture(target);
    openFile.mockResolvedValue({ status: 'opened', content });
    const consoleError = silenceErrors();
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');

    expect(noticeText(view)).toBe(`${message} Tus datos actuales no cambiaron.`);
    expect(hasText(view, 'El archivo es válido y contiene:')).toBe(false);
    expect(await snapshot(target)).toEqual(before);
    expect(consoleError).toHaveBeenCalledWith(
      'Backup read failed',
      expect.stringMatching(/^InvalidBackupError: /),
    );
  });

  it('rejects a backup with broken rules and logs only the problem codes', async () => {
    const text = (await backupText('A')).replace(
      /"amountMinor":(\d+)/,
      '"amountMinor":$1.25',
    );
    const target = await newDatabase();
    await seedBackupFixture(target, 'B');
    openFile.mockResolvedValue({ status: 'opened', content: text });
    const consoleError = silenceErrors();
    const view = await open(target);
    const before = await snapshot(target);

    await pressByTestId(view.root, 'backup-restore');

    expect(noticeText(view)).toContain('campo "amountMinor"');
    expect(await snapshot(target)).toEqual(before);
    expect(consoleError).toHaveBeenCalledWith(
      'Backup read failed',
      'InvalidBackupError: invalid_field',
    );
  });

  it.each([
    ['read_failed', 'No se pudo leer el archivo.'],
    ['too_large', 'El archivo supera el máximo de 25 MB.'],
    ['not_text', 'El archivo no es un respaldo de Control de Gastos.'],
    ['busy', 'Ya hay un selector de archivos abierto.'],
    [
      'unavailable',
      'El selector de archivos no está disponible en este dispositivo.',
    ],
  ] as const)('explains a %s file error', async (code, message) => {
    const target = await newDatabase();
    openFile.mockRejectedValue(new FileTransferError(code));
    silenceErrors();
    const view = await open(target);

    await pressByTestId(view.root, 'backup-restore');

    expect(noticeText(view)).toBe(`${message} Tus datos actuales no cambiaron.`);
  });
});
