"use client";

import { colorForCard } from "@/lib/color";
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
        {cards.map((card) => {
          const color = colorForCard(card.id, theme);
          const isPlotted = plotted.has(card.id);
          if (card.completed) {
            return (
              <div
                key={card.id}
                className="relative flex min-h-[40px] cursor-not-allowed touch-none items-start gap-2 overflow-hidden rounded-md border border-l-4 border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-[var(--color-muted)] opacity-60"
                style={isPlotted ? { borderLeftColor: color.edge } : undefined}
                title={`${card.name} (completed — locked)`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color.edge }}
                />
                <span className="break-words">{card.name}</span>
                {/* completed corner band (top-right) */}
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
              onPointerDown={(e) => beginCardDrag(card.id, card.name, e)}
              className="group flex min-h-[40px] cursor-grab touch-none items-start gap-2 rounded-md border border-l-4 border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-faint)] active:cursor-grabbing"
              style={isPlotted ? { borderLeftColor: color.edge } : undefined}
              title={card.name}
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color.edge }}
              />
              <span className="break-words">{card.name}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
