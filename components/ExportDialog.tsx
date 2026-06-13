"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  defaultFrom: string;
  defaultTo: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (from: string, to: string) => void;
}

export function ExportDialog({ open, defaultFrom, defaultTo, pending, onClose, onConfirm }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  if (!open) return null;

  const valid = from !== "" && to !== "" && from <= to;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Export to Sheets</h2>

        <div className="space-y-3 text-sm">
          <Row label="From">
            <DateInput value={from} onChange={setFrom} />
          </Row>
          <Row label="To">
            <DateInput value={to} onChange={setTo} />
          </Row>
        </div>

        {!valid && (
          <p className="mt-2 text-xs text-red-300/80">From must be on or before To.</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            disabled={!valid || pending}
            onClick={() => onConfirm(from, to)}
            className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-[#0f1113] disabled:opacity-40"
          >
            {pending ? "Exporting…" : "Export"}
          </button>
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

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      className="tabular rounded border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
