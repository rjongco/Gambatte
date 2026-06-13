"use client";

import { dayLabel } from "@/lib/dates";

interface Props {
  days: [string, string];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
}

export function DateNavBar({ days, onPrev, onNext, onToday, onOpenExport, onOpenSettings }: Props) {
  return (
    <header className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
      <h1 className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
        gambatte
      </h1>
      <div className="ml-2 flex items-center gap-1">
        <NavBtn onClick={onPrev} label="◀" />
        <button
          onClick={onToday}
          className="rounded px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          Today
        </button>
        <NavBtn onClick={onNext} label="▶" />
      </div>
      <span className="text-sm text-[var(--color-muted)]">
        {dayLabel(days[0])} — {dayLabel(days[1])}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onOpenExport}
          className="rounded px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          Submit
        </button>
        <button
          onClick={onOpenSettings}
          className="rounded px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          Settings
        </button>
      </div>
    </header>
  );
}

function NavBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
    >
      {label}
    </button>
  );
}
