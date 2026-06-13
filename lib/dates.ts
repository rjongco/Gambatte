import { addDays, format, parseISO } from "date-fns";

/** Plain YYYY-MM-DD strings, single local timezone. */
export function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function shiftDay(day: string, n: number): string {
  return format(addDays(parseISO(day), n), "yyyy-MM-dd");
}

export function dayLabel(day: string): string {
  return format(parseISO(day), "EEE MMM d");
}

/**
 * Human-readable label for a date range, used as the export tab title (and the
 * exact key for replace-on-identical-range). e.g. "Jun 8 – Jun 14, 2026".
 * Includes the year on both sides when the range spans two years.
 */
export function rangeLabel(from: string, to: string): string {
  const a = parseISO(from);
  const b = parseISO(to);
  const left = a.getFullYear() === b.getFullYear() ? format(a, "MMM d") : format(a, "MMM d, yyyy");
  return `${left} – ${format(b, "MMM d, yyyy")}`;
}
