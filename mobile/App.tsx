/**
 * Control de Gastos
 *
 * @format
 */

import { RootNavigator } from './src/app/navigation/RootNavigator';
import { AppProviders } from './src/app/providers/AppProviders';

function App() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default App;
