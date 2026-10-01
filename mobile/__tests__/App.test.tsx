/**
 * @format
 */

import React from 'react';
import { ActivityIndicator } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  // Async act lets DatabaseProvider finish opening and migrating the (node:sqlite) database.
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'No se pudo abrir la base de datos',
  );
});
