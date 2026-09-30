import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppTheme } from './theme';

/**
 * Returns the theme matching the device color scheme.
 * No Context is needed yet: the theme is derived from a system value.
 */
export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
