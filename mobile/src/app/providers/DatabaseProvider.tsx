import { useEffect, useState, type ReactNode } from 'react';
import { DatabaseContext, initDatabase, type Database } from '../../core/db';
import { EmptyState, LoadingState } from '../../shared/components';

type DatabaseState =
  | { status: 'loading' }
  | { status: 'ready'; database: Database }
  | { status: 'error'; error: Error };

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
    return <LoadingState />;
  }
  if (state.status === 'error') {
    return (
      <EmptyState
        icon="error"
        tone="error"
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
