import {
  NavigationContainer,
  type InitialState,
} from '@react-navigation/native';
import type { ReactTestRenderer as Renderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseContext, type Database } from '../../core/db';
import { renderAsync } from '../../shared/testing/testRenderer';
import { RootStack } from '../navigation/RootNavigator';

/** Fixed metrics so safe-area consumers render immediately under Jest. */
const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Tests only: the app's real routes over the given database (a real SQLite test database),
 * starting at `initialState`, e.g. `{ routes: [{ name: 'Accounts' }] }`.
 */
export function renderRootStack(
  database: Database,
  initialState: InitialState,
): Promise<Renderer> {
  return renderAsync(
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <DatabaseContext.Provider value={database}>
        <NavigationContainer initialState={initialState}>
          <RootStack />
        </NavigationContainer>
      </DatabaseContext.Provider>
    </SafeAreaProvider>,
  );
}
