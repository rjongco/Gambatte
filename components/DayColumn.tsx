"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeScale, minuteToX, formatHour12 } from "@/lib/time";
import { dayLabel } from "@/lib/dates";
import { ROW_HEIGHT, RULER_HEIGHT, MIN_BODY_ROWS } from "./constants";
import { useDrag, type ColScaleCtx } from "./DragContext";
import { OutControl } from "./OutControl";
import { TaskBar } from "./TaskBar";
import type { Placement } from "@/lib/types";

interface Bar {
  placement: Placement;
  rowIndex: number;
}

interface Props {
  day: string;
  bars: Bar[];
  dayStart: number;
  dayEnd: number;
  out: number; // effective out
  laneCount: number;
  onSetOut: (day: string, outMinute: number | null) => void;
  onCommit: (id: string, patch: { startMinute: number; endMinute: number }) => void;
  onDelete: (id: string) => void;
}

export function DayColumn({
  day,
  bars,
  dayStart,
  dayEnd,
  out,
  laneCount,
  onSetOut,
  onCommit,
  onDelete,
}: Props) {
  const { registerColumn, drag } = useDrag();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const pxPerMinute = computeScale(width, dayStart, out);
  const ctx: ColScaleCtx = { dayStart, pxPerMinute, out };

  // keep latest scale available to the drag hit-test without re-registering
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    return registerColumn(day, el, () => ctxRef.current);
  }, [day, registerColumn]);

  const bodyHeight = Math.max(laneCount, MIN_BODY_ROWS) * ROW_HEIGHT;
  const isDropTarget = drag?.overDay === day;

  // Out cannot drop below the latest completed (painted) bar on this day.
  const minOut = bars.reduce(
    (m, b) => (b.placement.completed ? Math.max(m, b.placement.endMinute) : m),
    dayStart + 30,
  );

  // hour ticks for this column's own scale, thinned so labels never collide
  const pxPerHour = 60 * pxPerMinute;
  const stepH = pxPerHour >= 46 ? 1 : pxPerHour >= 24 ? 2 : pxPerHour >= 16 ? 3 : 4;
  const ticks: number[] = [];
  const startHour = Math.ceil(dayStart / 60);
  for (let h = startHour; (h * 60) <= out; h += stepH) ticks.push(h * 60);

  const gridStyle =
    width > 0
      ? {
          backgroundImage: `repeating-linear-gradient(90deg, var(--color-line-soft) 0 1px, transparent 1px ${30 * pxPerMinute}px), repeating-linear-gradient(90deg, var(--color-line) 0 1px, transparent 1px ${60 * pxPerMinute}px)`,
        }
      : undefined;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm font-medium text-[var(--color-text)]">{dayLabel(day)}</span>
        <OutControl out={out} dayStart={dayStart} dayEnd={dayEnd} minOut={minOut} onChange={(v) => onSetOut(day, v)} />
      </div>

      {/* ruler */}
      <div
        className="relative border-b border-[var(--color-line)]"
        style={{ height: RULER_HEIGHT }}
      >
        {width > 0 &&
          ticks.map((m) => {
            const frac = (m - dayStart) / (out - dayStart); // 0=left edge, 1=right edge
            return (
              <span
                key={m}
                className="tabular absolute top-1 text-[10px] text-[var(--color-faint)]"
                style={{ left: minuteToX(m, ctx), transform: `translateX(${-frac * 100}%)` }}
              >
                {formatHour12(m)}
              </span>
            );
          })}
      </div>

      {/* body / drop zone */}
      <div
        ref={bodyRef}
        className="relative flex-1"
        style={{ minHeight: bodyHeight, ...gridStyle }}
      >
        {/* lane separators */}
        {Array.from({ length: Math.max(laneCount, MIN_BODY_ROWS) }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-x-0 border-b border-[var(--color-line-soft)]"
            style={{ top: (i + 1) * ROW_HEIGHT - 1, height: 0 }}
          />
        ))}

        {isDropTarget && (
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: "rgba(124,156,255,0.07)",
              boxShadow: "inset 0 0 0 1px rgba(124,156,255,0.45)",
            }}
          />
        )}

        {width > 0 &&
          bars.map(({ placement, rowIndex }) => (
            <TaskBar
              key={placement.id}
              id={placement.id}
              cardId={placement.cardId}
              cardName={placement.cardName}
              startMinute={placement.startMinute}
              endMinute={placement.endMinute}
              rowIndex={rowIndex}
              completed={placement.completed}
              ctx={ctx}
              onCommit={onCommit}
              onDelete={onDelete}
            />
          ))}
      </div>
    </div>
  );
}
