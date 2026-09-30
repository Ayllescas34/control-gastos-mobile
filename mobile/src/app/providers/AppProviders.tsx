import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Single place to compose app-wide providers as they are introduced. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
