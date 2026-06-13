export interface ScaleCtx {
  /** Left edge of the day in minutes (e.g. 480 = 08:00). */
  dayStart: number;
  /** Pixels per minute for this day's cell. */
  pxPerMinute: number;
}

/** Round to the nearest 30-minute mark. */
export function snapTo30(minute: number): number {
  return Math.round(minute / 30) * 30;
}

/** px/minute so that dayStart..out exactly fills `cellWidth`. */
export function computeScale(cellWidth: number, dayStart: number, out: number): number {
  const span = out - dayStart;
  return span > 0 ? cellWidth / span : 0;
}

export function minuteToX(minute: number, { dayStart, pxPerMinute }: ScaleCtx): number {
  return (minute - dayStart) * pxPerMinute;
}

/** Inverse of minuteToX (does NOT snap — callers snap when committing). */
export function xToMinute(x: number, { dayStart, pxPerMinute }: ScaleCtx): number {
  if (pxPerMinute === 0) return dayStart;
  return dayStart + x / pxPerMinute;
}

function parts12(minute: number): { h12: number; m: number; period: "AM" | "PM" } {
  const h24 = Math.floor(minute / 60) % 24; // 1440 -> 0 (midnight)
  const m = minute % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, m, period };
}

/** 12-hour time, e.g. "8:00 AM", "2:30 PM". 1440 -> "12:00 AM" (midnight). */
export function formatMinute(minute: number): string {
  const { h12, m, period } = parts12(minute);
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Compact 12-hour hour label for dense rulers, e.g. "8 AM", "12 PM". */
export function formatHour12(minute: number): string {
  const { h12, period } = parts12(minute);
  return `${h12} ${period}`;
}
