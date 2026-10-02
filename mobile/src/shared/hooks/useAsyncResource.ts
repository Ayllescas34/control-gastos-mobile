import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncResource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: Error };

/**
 * Loads data asynchronously and exposes its state. The source of truth stays outside React
 * (e.g. SQLite); this only mirrors the last result for the UI.
 *
 * - The first load shows `loading`; later reloads keep the current data visible until the
 *   new result arrives, so screens do not flash a spinner on every refresh.
 * - Only the latest request may update the state: stale or post-unmount results are dropped.
 */
export function useAsyncResource<T>(load: () => Promise<T>): {
  resource: AsyncResource<T>;
  reload: () => void;
} {
  const [resource, setResource] = useState<AsyncResource<T>>({
    status: 'loading',
  });
  const latestRequest = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    const request = ++latestRequest.current;
    const isCurrent = () =>
      mounted.current && request === latestRequest.current;

    load().then(
      data => {
        if (isCurrent()) {
          setResource({ status: 'ready', data });
        }
      },
      (error: unknown) => {
        if (isCurrent()) {
          setResource({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
  }, [load]);

  return { resource, reload };
}
