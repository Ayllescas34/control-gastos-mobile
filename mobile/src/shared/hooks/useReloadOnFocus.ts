import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

/**
 * Reloads whenever the screen gains focus, e.g. after creating, editing or archiving on
 * another screen. Keeps SQLite the source of truth without a global store.
 */
export function useReloadOnFocus(reload: () => void): void {
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
}
