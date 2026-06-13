"use client";

import { useState } from "react";
import { formatMinute } from "@/lib/time";
import type { Settings } from "@/lib/types";

type Theme = "night" | "day";

interface Props {
  open: boolean;
  settings: Settings;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onClose: () => void;
  onSave: (s: Settings) => void;
  onResync: () => void;
}

function options(from: number, to: number) {
  const out: number[] = [];
  for (let m = from; m <= to; m += 30) out.push(m);
  return out;
}

export function SettingsDialog({
  open,
  settings,
  theme,
  onThemeChange,
  onClose,
  onSave,
  onResync,
}: Props) {
  const [start, setStart] = useState(settings.dayStartMinute);
  const [end, setEnd] = useState(settings.dayEndMinute);
  if (!open) return null;

  const valid = end > start;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Settings</h2>

        <div className="space-y-3 text-sm">
          <Row label="Appearance">
            <div className="flex gap-1.5">
              {(["night", "day"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onThemeChange(t)}
                  className={`rounded border px-2.5 py-1 text-xs capitalize ${
                    theme === t
                      ? "border-[var(--color-accent)] text-[var(--color-text)]"
                      : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }`}
                  aria-pressed={theme === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Day start">
            <Select value={start} onChange={setStart} options={options(0, 1410)} />
          </Row>
          <Row label="Day end (max Out)">
            <Select value={end} onChange={setEnd} options={options(30, 1440)} />
          </Row>
        </div>

        {!valid && (
          <p className="mt-2 text-xs text-red-300/80">Day end must be after day start.</p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={onResync}
            className="rounded border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Re-sync Trello
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded px-3 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => onSave({ dayStartMinute: start, dayEndMinute: end })}
              className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-[#0f1113] disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
}) {
  return (
    <select
      className="tabular rounded border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {formatMinute(m)}
        </option>
      ))}
    </select>
  );
}
