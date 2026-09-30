import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * Formats a civil date ("YYYY-MM-DD") for display.
 * parseISO treats date-only strings as local midnight, so the day never shifts by time zone.
 */
export function formatLocalDate(localDate: string, pattern = 'd MMM yyyy'): string {
  return format(parseISO(localDate), pattern, { locale: es });
}
