/**
 * The only place that converts between instants and calendar dates.
 *
 * Calendar dates are plain `YYYY-MM-DD` strings, always in the configured
 * timezone (`TZ`). Instants are `Date` objects or UTC ISO strings.
 */

export const DEFAULT_TIME_ZONE = "Europe/London";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function timeZone(): string {
  return process.env.TZ || DEFAULT_TIME_ZONE;
}

export function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

function wallClock(instant: Date, zone: string) {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter(zone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts as Record<
    "year" | "month" | "day" | "hour" | "minute" | "second",
    number
  >;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * The calendar date of an instant, in the configured timezone.
 */
export function toCalendarDate(
  instant: Date | string,
  zone: string = timeZone(),
): string {
  const { year, month, day } = wallClock(new Date(instant), zone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * Today's calendar date in the configured timezone.
 */
export function today(now: Date = new Date(), zone: string = timeZone()) {
  return toCalendarDate(now, zone);
}

/**
 * Move a calendar date by a number of days. Timezone-free.
 */
export function addDays(date: string, days: number): string {
  const match = CALENDAR_DATE.exec(date);
  if (!match) throw new Error(`Not a calendar date: ${date}`);
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Compare two calendar dates, for sorting.
 */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whole days from `a` to `b`.
 */
export function daysBetween(a: string, b: string): number {
  const toUtc = (date: string) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/**
 * The instant at which a wall-clock time happens on a calendar date, in the
 * configured timezone. A time skipped by a DST change resolves to the instant
 * an hour later; a repeated time resolves to its first occurrence.
 */
export function zonedInstant(
  date: string,
  time: string,
  zone: string = timeZone(),
): Date {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const target = Date.UTC(y, mo - 1, d, h, mi);

  const offsetAt = (instant: number) => {
    const w = wallClock(new Date(instant), zone);
    return (
      Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - instant
    );
  };

  // Try both offsets either side of the target and keep the earliest one
  // that lands on the requested wall-clock time.
  const candidates = [
    target - offsetAt(target - 86_400_000),
    target - offsetAt(target + 86_400_000),
  ].sort((a, b) => a - b);
  for (const candidate of candidates) {
    if (candidate + offsetAt(candidate) === target) {
      return new Date(candidate);
    }
  }
  // Skipped by a DST change: fall back to the later offset
  return new Date(candidates[1]!);
}

/**
 * "Monday 2 November 2026"
 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * "2 November 2026 at 03:00", in the configured timezone.
 */
export function formatInstant(
  instant: Date | string,
  zone: string = timeZone(),
): string {
  const w = wallClock(new Date(instant), zone);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(w.year, w.month - 1, w.day)));
  return `${date} at ${pad(w.hour)}:${pad(w.minute)}`;
}

/**
 * "03:00:02", in the configured timezone.
 */
export function formatTime(
  instant: Date | string,
  zone: string = timeZone(),
): string {
  const w = wallClock(new Date(instant), zone);
  return `${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
}
