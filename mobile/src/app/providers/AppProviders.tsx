import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLockGate } from '../../features/security';
import { DatabaseProvider } from './DatabaseProvider';

/** Single place to compose app-wide providers as they are introduced. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      {/* The PIN comes first: nothing of the user's data shows before it. */}
      <AppLockGate>
        <DatabaseProvider>{children}</DatabaseProvider>
      </AppLockGate>
    </SafeAreaProvider>
  );
}
