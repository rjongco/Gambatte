"use client";

import { formatMinute } from "@/lib/time";

interface Props {
  out: number; // effective out (defaults to dayEnd)
  dayStart: number;
  dayEnd: number;
  /** Lowest selectable Out: dayStart+30, raised to the latest completed bar's end. */
  minOut: number;
  onChange: (outMinute: number | null) => void;
}

export function OutControl({ out, dayStart, dayEnd, minOut, onChange }: Props) {
  const options: number[] = [];
  const first = Math.max(dayStart + 30, minOut);
  for (let m = first; m <= dayEnd; m += 30) options.push(m);

  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
      <span className="uppercase tracking-wide">Out</span>
      <select
        className="tabular rounded border border-[var(--color-line)] bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        value={out}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v === dayEnd ? null : v); // dayEnd == no cap -> clear the row
        }}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {formatMinute(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
