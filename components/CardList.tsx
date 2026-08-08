"use client";

import { useState } from "react";
import { colorForCard } from "@/lib/color";
import { trelloCreatedMs } from "@/lib/dates";
import { useDrag } from "./DragContext";
import { useTheme } from "./ThemeContext";
import type { Card } from "@/lib/types";

interface Props {
  cards: Card[];
  plottedIds: string[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
}

export function CardList({ cards, plottedIds, loading, error, onRefresh }: Props) {
  const { beginCardDrag } = useDrag();
  const theme = useTheme();
  const plotted = new Set(plottedIds);
  // Groups expanded by default; a collapsed set tracks the exceptions.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Split into top-level cards + task-cards grouped under their parent.
  const parents = cards.filter((c) => c.parentCardId == null);
  const childrenByParent = new Map<string, Card[]>();
  for (const c of cards) {
    if (c.parentCardId) {
      const arr = childrenByParent.get(c.parentCardId) ?? [];
      arr.push(c);
      childrenByParent.set(c.parentCardId, arr);
    }
  }
  // Parents: newest-created on top. Children: natural checklist order.
  parents.sort((a, b) => trelloCreatedMs(b.id) - trelloCreatedMs(a.id));
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => (a.checkPos ?? 0) - (b.checkPos ?? 0));
  }

  /** A draggable (or done/locked) card or task-card chip. */
  function leaf(card: Card, displayName: string, dragName: string, indent: boolean) {
    const color = colorForCard(card.parentCardId ?? card.id, theme);
    const isPlotted = plotted.has(card.id);
    const pad = indent ? "ml-4" : "";
    if (card.completed) {
      return (
        <div
          key={card.id}
          className={`relative flex min-h-[40px] cursor-not-allowed touch-none items-start gap-2 overflow-hidden rounded-md border border-l-4 border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-[var(--color-muted)] opacity-60 ${pad}`}
          style={isPlotted ? { borderLeftColor: color.edge } : undefined}
          title={`${displayName} (completed — locked)`}
        >
          <span
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: color.edge }}
          />
          <span className="break-words">{displayName}</span>
          <span
            className="pointer-events-none absolute -right-7 top-1 w-16 rotate-45 text-center text-[8px] font-bold uppercase tracking-wide text-white shadow"
            style={{ background: "var(--color-completed)" }}
          >
            Done
          </span>
        </div>
      );
    }
    return (
      <div
        key={card.id}
        onPointerDown={(e) => beginCardDrag(card.id, dragName, e)}
        className={`group flex min-h-[40px] cursor-grab touch-none items-start gap-2 rounded-md border border-l-4 border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-faint)] active:cursor-grabbing ${pad}`}
        style={isPlotted ? { borderLeftColor: color.edge } : undefined}
        title={dragName}
      >
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color.edge }}
        />
        <span className="break-words">{displayName}</span>
      </div>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Tasks
        </h2>
        <button
          onClick={onRefresh}
          className="rounded px-1.5 py-0.5 text-xs text-[var(--color-faint)] hover:text-[var(--color-text)]"
          title="Re-sync from Trello"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 space-y-1.5 overflow-auto px-3 pb-4">
        {loading && <p className="px-1 text-xs text-[var(--color-faint)]">Loading…</p>}
        {error && (
          <p className="px-1 text-xs leading-relaxed text-red-300/80">
            {error}
          </p>
        )}
        {!loading && !error && cards.length === 0 && (
          <p className="px-1 text-xs text-[var(--color-faint)]">No matching cards.</p>
        )}
        {parents.map((parent) => {
          const kids = childrenByParent.get(parent.id) ?? [];
          // No task-cards → a normal draggable card, exactly as before.
          if (kids.length === 0) {
            return leaf(parent, parent.name, parent.name, false);
          }
          // Has task-cards → non-draggable group header + its task leaves.
          const expanded = !collapsed.has(parent.id);
          return (
            <div key={parent.id} className="space-y-1.5">
              <button
                onClick={() => toggle(parent.id)}
                className={`flex min-h-[40px] w-full items-start gap-1.5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-2 text-left text-sm text-[var(--color-text)] hover:border-[var(--color-faint)] ${
                  parent.completed ? "opacity-60" : ""
                }`}
                title={parent.name}
              >
                <span className="mt-0.5 w-3 shrink-0 text-[var(--color-faint)]">
                  {expanded ? "▾" : "▸"}
                </span>
                <span className="break-words font-medium">{parent.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-[var(--color-faint)]">
                  {kids.length}
                </span>
              </button>
              {expanded &&
                kids.map((kid) => leaf(kid, kid.name, `${parent.name}:${kid.name}`, true))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
