import { isCalendarDate } from "../dates.ts";
import type { DateParts } from "./views/components/forms.ts";

export type FormBody = Record<string, string | File | Array<string | File>>;

/**
 * Every value submitted for a field, as strings.
 */
export function formValues(body: FormBody, key: string): string[] {
  const value = body[key];
  const all = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return all.filter((v): v is string => typeof v === "string");
}

/**
 * The first value submitted for a field, trimmed.
 */
export function formValue(body: FormBody, key: string): string {
  return (formValues(body, key)[0] ?? "").trim();
}

export function dateParts(
  source: (key: string) => string | undefined,
  prefix: string,
): DateParts {
  return {
    day: (source(`${prefix}-day`) ?? "").trim(),
    month: (source(`${prefix}-month`) ?? "").trim(),
    year: (source(`${prefix}-year`) ?? "").trim(),
  };
}

export function partsFromDate(date: string): DateParts {
  const [year, month, day] = date.split("-");
  return {
    day: String(Number(day)),
    month: String(Number(month)),
    year: year!,
  };
}

/**
 * Turn day/month/year inputs into a calendar date, or say what's wrong.
 */
export function parseDateParts(
  parts: DateParts,
  label: string,
): { date: string } | { error: string } {
  const missing = (["day", "month", "year"] as const).filter((k) => !parts[k]);
  if (missing.length === 3) return { error: `Enter the ${label}` };
  if (missing.length > 0) {
    return {
      error: `${capitalise(label)} must include a ${missing.join(" and a ")}`,
    };
  }
  if (![parts.day, parts.month, parts.year].every((p) => /^\d+$/.test(p))) {
    return { error: `${capitalise(label)} must be a real date` };
  }
  if (parts.year.length !== 4) {
    return { error: "Year must include 4 numbers" };
  }
  const date = `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  if (!isCalendarDate(date)) {
    return { error: `${capitalise(label)} must be a real date` };
  }
  return { date };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A positive page number from the query string.
 */
export function pageNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * Build a URL with query parameters, leaving out empty ones.
 */
export function withQuery(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
