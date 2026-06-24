"use client";

import { useRef, useState } from "react";
import { minuteToX, snapTo30, formatMinute } from "@/lib/time";
import { colorForCard } from "@/lib/color";
import { ROW_HEIGHT, BAR_GAP } from "./constants";
import type { ColScaleCtx } from "./DragContext";
import { useTheme } from "./ThemeContext";

interface Props {
  id: string;
  cardId: string;
  cardName: string;
  startMinute: number;
  endMinute: number;
  rowIndex: number;
  completed: boolean;
  ctx: ColScaleCtx;
  onCommit: (id: string, patch: { startMinute: number; endMinute: number }) => void;
  onDelete: (id: string) => void;
}

type Gesture = "move" | "resize-l" | "resize-r";

export function TaskBar({
  id,
  cardId,
  cardName,
  startMinute,
  endMinute,
  rowIndex,
  completed,
  ctx,
  onCommit,
  onDelete,
}: Props) {
  const [preview, setPreview] = useState<{
    start: number;
    end: number;
    cx: number;
    cy: number;
  } | null>(null);
  const gesture = useRef<{
    kind: Gesture;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const theme = useTheme();
  const start = preview?.start ?? startMinute;
  const end = preview?.end ?? endMinute;
  const color = colorForCard(cardId, theme);

  const left = minuteToX(start, ctx);
  const width = Math.max(2, (end - start) * ctx.pxPerMinute);
  const top = rowIndex * ROW_HEIGHT + BAR_GAP;
  const height = ROW_HEIGHT - BAR_GAP * 2;

  function begin(kind: Gesture, e: React.PointerEvent) {
    if (completed) return; // painted & immutable — no move/resize
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    gesture.current = { kind, startX: e.clientX, origStart: startMinute, origEnd: endMinute };
  }

  function onMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const deltaMin = (e.clientX - g.startX) / ctx.pxPerMinute;
    let s = g.origStart;
    let en = g.origEnd;
    const duration = g.origEnd - g.origStart;
    if (g.kind === "move") {
      s = snapTo30(g.origStart + deltaMin);
      s = Math.max(ctx.dayStart, Math.min(s, ctx.out - duration));
      en = s + duration;
    } else if (g.kind === "resize-l") {
      s = snapTo30(g.origStart + deltaMin);
      s = Math.max(ctx.dayStart, Math.min(s, g.origEnd - 30));
    } else {
      en = snapTo30(g.origEnd + deltaMin);
      en = Math.min(ctx.out, Math.max(en, g.origStart + 30));
    }
    setPreview({ start: s, end: en, cx: e.clientX, cy: e.clientY });
  }

  function end_(e: React.PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const p = preview;
    setPreview(null);
    if (!g || !p) return;
    if (p.start !== startMinute || p.end !== endMinute) {
      onCommit(id, { startMinute: p.start, endMinute: p.end });
    }
  }

  const label = `${cardName} · ${formatMinute(start)}–${formatMinute(end)}`;

  return (
    <>
    <div
      className={`group absolute flex items-center overflow-hidden rounded-md border-l-2 text-[11px] leading-tight select-none touch-none ${
        completed
          ? "opacity-70"
          : "shadow-sm shadow-black/30 transition-[box-shadow] hover:shadow-md hover:shadow-black/40"
      }`}
      style={{
        left,
        width,
        top,
        height,
        background: color.fill,
        borderColor: color.edge,
        color: color.text,
        cursor: completed ? "default" : gesture.current?.kind === "move" ? "grabbing" : "grab",
      }}
      title={completed ? `${label} (completed — locked)` : label}
      onPointerDown={(e) => begin("move", e)}
      onPointerMove={onMove}
      onPointerUp={end_}
    >
      {/* left resize handle (omitted when completed) */}
      {!completed && (
        <span
          className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize"
          onPointerDown={(e) => begin("resize-l", e)}
          onPointerMove={onMove}
          onPointerUp={end_}
        />
      )}
      <span className="truncate px-2 font-medium">{cardName}</span>
      <span className="tabular ml-auto hidden shrink-0 px-1.5 opacity-70 group-hover:inline">
        {formatMinute(start)}–{formatMinute(end)}
      </span>
      {/* right resize handle (omitted when completed) */}
      {!completed && (
        <span
          className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize"
          onPointerDown={(e) => begin("resize-r", e)}
          onPointerMove={onMove}
          onPointerUp={end_}
        />
      )}
      {/* delete (omitted when completed — painted & immutable) */}
      {!completed && (
        <button
          className="absolute right-1 top-1 z-20 hidden h-4 w-4 items-center justify-center rounded-full bg-black/40 text-[11px] leading-none hover:bg-black/70 group-hover:flex"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          aria-label="Delete"
        >
          ×
        </button>
      )}
    </div>
    {preview && (
      <div
        className="tabular pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[11px] whitespace-nowrap text-[var(--color-text)] shadow-lg shadow-black/40"
        style={{ left: preview.cx, top: preview.cy }}
      >
        {formatMinute(preview.start)} – {formatMinute(preview.end)}
      </div>
    )}
    </>
  );
}
