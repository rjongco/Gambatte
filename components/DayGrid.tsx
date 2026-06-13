"use client";

import { assignLanes, type LanePlacement } from "@/lib/lanes";
import { DayColumn } from "./DayColumn";
import type { Placement, Settings, WindowData } from "@/lib/types";

interface Props {
  days: [string, string];
  data: WindowData;
  settings: Settings;
  onSetOut: (day: string, outMinute: number | null) => void;
  onCommit: (id: string, patch: { startMinute: number; endMinute: number }) => void;
  onDelete: (id: string) => void;
}

export function DayGrid({ days, data, settings, onSetOut, onCommit, onDelete }: Props) {
  const byDay: Record<string, Placement[]> = { [days[0]]: [], [days[1]]: [] };
  for (const p of data.placements) {
    if (byDay[p.day]) byDay[p.day].push(p);
  }

  const lanePlacements: Record<string, LanePlacement[]> = {
    [days[0]]: byDay[days[0]].map((p) => ({ cardId: p.cardId, day: p.day, startMinute: p.startMinute })),
    [days[1]]: byDay[days[1]].map((p) => ({ cardId: p.cardId, day: p.day, startMinute: p.startMinute })),
  };
  const { laneByDay, laneCount } = assignLanes(days, lanePlacements);

  return (
    <div className="flex flex-1 overflow-auto">
      {days.map((day, i) => {
        const out = data.outByDay[day] ?? settings.dayEndMinute;
        const bars = byDay[day].map((p) => ({ placement: p, rowIndex: laneByDay[day][p.cardId] ?? 0 }));
        return (
          <div
            key={day}
            className={i === 0 ? "border-r border-[var(--color-line)]" : ""}
            style={{ flex: 1, minWidth: 0, display: "flex" }}
          >
            <DayColumn
              day={day}
              bars={bars}
              dayStart={settings.dayStartMinute}
              dayEnd={settings.dayEndMinute}
              out={out}
              laneCount={laneCount}
              onSetOut={onSetOut}
              onCommit={onCommit}
              onDelete={onDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
