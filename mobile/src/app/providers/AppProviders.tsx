import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from './DatabaseProvider';

/** Single place to compose app-wide providers as they are introduced. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>{children}</DatabaseProvider>
    </SafeAreaProvider>
  );
}
