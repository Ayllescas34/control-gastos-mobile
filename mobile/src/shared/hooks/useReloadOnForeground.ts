import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Reloads when the app returns to the foreground, e.g. after granting a permission in
 * system settings or after a payment captured while the app was in the background. Screen
 * focus does not change in those cases, so useReloadOnFocus alone would miss them.
 */
export function useReloadOnForeground(reload: () => void): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        reload();
      }
    });
    return () => subscription.remove();
  }, [reload]);
}
