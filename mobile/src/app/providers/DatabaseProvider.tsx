import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { initDatabase, type Database } from '../../core/db';
import { EmptyState } from '../../shared/components';
import { useAppTheme } from '../../shared/theme';

type DatabaseState =
  | { status: 'loading' }
  | { status: 'ready'; database: Database }
  | { status: 'error'; error: Error };

const DatabaseContext = createContext<Database | null>(null);

/**
 * Opens and migrates the local database before rendering `children`, so every screen below
 * can assume it is ready. A failure is logged and shown, never swallowed.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatabaseState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    initDatabase().then(
      database => {
        if (active) {
          setState({ status: 'ready', database });
        }
      },
      (error: unknown) => {
        console.error('Database initialization failed', error);
        if (active) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') {
    return <DatabaseLoading />;
  }
  if (state.status === 'error') {
    return (
      <EmptyState
        title="No se pudo abrir la base de datos"
        message={state.error.message}
      />
    );
  }
  return (
    <DatabaseContext.Provider value={state.database}>
      {children}
    </DatabaseContext.Provider>
  );
}

/** The ready database. Only usable below DatabaseProvider. */
export function useDatabase(): Database {
  const database = useContext(DatabaseContext);
  if (!database) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return database;
}

function DatabaseLoading() {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.loading, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
