/**
 * Static app configuration. Never put secrets here: everything in the JS bundle is public.
 */
export const appConfig = {
  appName: 'Control de Gastos',
  defaultCurrency: 'GTQ',
  locale: 'es-GT',
} as const;
