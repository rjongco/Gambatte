"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { snapTo30, xToMinute, formatMinute } from "@/lib/time";

export interface ColScaleCtx {
  dayStart: number;
  pxPerMinute: number;
  out: number;
}

interface ColEntry {
  day: string;
  el: HTMLElement;
  getCtx: () => ColScaleCtx;
}

interface DragState {
  cardId: string;
  cardName: string;
  x: number;
  y: number;
  overDay: string | null;
  /** Prospective placement at the current cursor (null when not over a valid spot). */
  preview: { start: number; end: number } | null;
}

/** The 1-hour bar a drop at `relX` would create, or null if it can't fit before Out.
 *  Shared by the live preview and the actual drop so they never disagree. */
function plannedDrop(relX: number, ctx: ColScaleCtx): { start: number; end: number } | null {
  let start = snapTo30(xToMinute(relX, ctx));
  start = Math.max(ctx.dayStart, Math.min(start, ctx.out - 60));
  const end = Math.min(start + 60, ctx.out);
  if (end - start < 30) return null;
  return { start, end };
}

export interface DropPayload {
  cardId: string;
  day: string;
  startMinute: number;
  endMinute: number;
}

interface DragApi {
  drag: DragState | null;
  registerColumn: (day: string, el: HTMLElement, getCtx: () => ColScaleCtx) => () => void;
  beginCardDrag: (cardId: string, cardName: string, e: React.PointerEvent) => void;
}

const Ctx = createContext<DragApi | null>(null);

export function useDrag(): DragApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDrag must be used within DragProvider");
  return v;
}

export function DragProvider({
  onDrop,
  onReject,
  children,
}: {
  onDrop: (p: DropPayload) => void;
  onReject: (message: string) => void;
  children: React.ReactNode;
}) {
  const columns = useRef(new Map<string, ColEntry>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const registerColumn = useCallback(
    (day: string, el: HTMLElement, getCtx: () => ColScaleCtx) => {
      columns.current.set(day, { day, el, getCtx });
      return () => {
        if (columns.current.get(day)?.el === el) columns.current.delete(day);
      };
    },
    [],
  );

  const hitTest = useCallback((x: number, y: number): ColEntry | null => {
    for (const entry of columns.current.values()) {
      const r = entry.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return entry;
    }
    return null;
  }, []);

  const beginCardDrag = useCallback(
    (cardId: string, cardName: string, e: React.PointerEvent) => {
      e.preventDefault();
      const init: DragState = {
        cardId,
        cardName,
        x: e.clientX,
        y: e.clientY,
        overDay: null,
        preview: null,
      };
      dragRef.current = init;
      setDrag(init);

      const move = (ev: PointerEvent) => {
        const hit = hitTest(ev.clientX, ev.clientY);
        let preview: { start: number; end: number } | null = null;
        if (hit) {
          const rect = hit.el.getBoundingClientRect();
          preview = plannedDrop(ev.clientX - rect.left, hit.getCtx());
        }
        const next: DragState = {
          ...dragRef.current!,
          x: ev.clientX,
          y: ev.clientY,
          overDay: hit?.day ?? null,
          preview,
        };
        dragRef.current = next;
        setDrag(next);
      };

      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const hit = hitTest(ev.clientX, ev.clientY);
        const state = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!hit || !state) return;

        const rect = hit.el.getBoundingClientRect();
        const plan = plannedDrop(ev.clientX - rect.left, hit.getCtx());
        if (!plan) {
          onReject("Not enough room before the Out time.");
          return;
        }
        onDrop({ cardId: state.cardId, day: hit.day, startMinute: plan.start, endMinute: plan.end });
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [hitTest, onDrop, onReject],
  );

  return (
    <Ctx.Provider value={{ drag, registerColumn, beginCardDrag }}>
      {children}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 -translate-y-1/2 translate-x-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text)] shadow-lg shadow-black/40"
          style={{ left: drag.x, top: drag.y }}
        >
          <div>{drag.cardName}</div>
          {drag.preview && (
            <div className="tabular mt-0.5 text-[var(--color-muted)]">
              {formatMinute(drag.preview.start)} – {formatMinute(drag.preview.end)}
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}
