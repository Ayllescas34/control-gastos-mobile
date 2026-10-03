import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import type { IsoDateTime, LocalDate } from '../../domain';

const LOCAL_DATE_FORMAT = 'yyyy-MM-dd';
const LOCAL_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Civil date (device time zone) of an instant, as YYYY-MM-DD. */
export function toLocalDate(date: Date): LocalDate {
  return format(date, LOCAL_DATE_FORMAT);
}

/** Today's civil date in the device time zone. */
export function todayLocalDate(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** Whether text is a real calendar day in YYYY-MM-DD (rejects 2026-02-30). */
export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_SHAPE.test(value)) {
    return false;
  }
  const date = parse(value, LOCAL_DATE_FORMAT, new Date());
  return isValid(date) && toLocalDate(date) === value;
}

/** The civil date `days` days before `localDate`. */
export function localDateDaysBefore(
  localDate: LocalDate,
  days: number,
): LocalDate {
  return toLocalDate(
    subDays(parse(localDate, LOCAL_DATE_FORMAT, new Date()), days),
  );
}

/** First and last civil date of the month containing `now`, `monthsAgo` months back. */
export function monthRange(
  now: Date,
  monthsAgo = 0,
): { from: LocalDate; to: LocalDate } {
  const month = subMonths(now, monthsAgo);
  return {
    from: toLocalDate(startOfMonth(month)),
    to: toLocalDate(endOfMonth(month)),
  };
}

/** Every civil date from `from` to `to`, both included (empty when `to` is before `from`). */
export function localDatesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const start = parse(from, LOCAL_DATE_FORMAT, new Date());
  const end = parse(to, LOCAL_DATE_FORMAT, new Date());
  if (end < start) {
    return [];
  }
  return eachDayOfInterval({ start, end }).map(toLocalDate);
}

/**
 * The UTC instant to store for a movement on `localDate`: now when it is today, otherwise
 * noon of that day in the device time zone (its local date stays the chosen one in any
 * nearby time zone, and ordering within the day is stable).
 */
export function occurredAtFor(
  localDate: LocalDate,
  now: Date = new Date(),
): IsoDateTime {
  if (localDate === toLocalDate(now)) {
    return now.toISOString();
  }
  const day = parse(localDate, LOCAL_DATE_FORMAT, new Date());
  day.setHours(12, 0, 0, 0);
  return day.toISOString();
}
