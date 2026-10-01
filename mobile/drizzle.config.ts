import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit only generates migrations here; it never connects to a database.
 * `driver: 'expo'` makes it emit migrations.js (bundled .sql imports) for React Native.
 * It does not install or require Expo.
 */
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/core/db/schema/index.ts',
  out: './src/core/db/migrations',
});
