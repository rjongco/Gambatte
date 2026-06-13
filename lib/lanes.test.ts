import { describe, it, expect } from "vitest";
import { assignLanes, type LanePlacement } from "./lanes";

const MON = "2026-06-08";
const TUE = "2026-06-09";

function p(cardId: string, day: string, startMinute: number): LanePlacement {
  return { cardId, day, startMinute };
}

describe("assignLanes", () => {
  it("gives a single-day card row 0 in its own day", () => {
    const { laneByDay, laneCount } = assignLanes([MON, TUE], {
      [MON]: [p("A", MON, 480)],
      [TUE]: [],
    });
    expect(laneByDay[MON]["A"]).toBe(0);
    expect(laneCount).toBe(1);
  });

  it("reuses the same row index across days for different single-day cards", () => {
    const { laneByDay, laneCount } = assignLanes([MON, TUE], {
      [MON]: [p("A", MON, 480)],
      [TUE]: [p("B", TUE, 480)],
    });
    expect(laneByDay[MON]["A"]).toBe(0);
    expect(laneByDay[TUE]["B"]).toBe(0);
    expect(laneCount).toBe(1);
  });

  it("pins a spanning card to the top row in BOTH cells", () => {
    const { laneByDay, laneCount } = assignLanes([MON, TUE], {
      [MON]: [p("S", MON, 600), p("A", MON, 480)],
      [TUE]: [p("S", TUE, 480)],
    });
    // S is spanning -> row 0 in both days; A is single-day -> below
    expect(laneByDay[MON]["S"]).toBe(0);
    expect(laneByDay[TUE]["S"]).toBe(0);
    expect(laneByDay[MON]["A"]).toBe(1);
    expect(laneCount).toBe(2);
  });

  it("orders spanning cards among themselves by earliest start", () => {
    const { laneByDay } = assignLanes([MON, TUE], {
      [MON]: [p("S1", MON, 600), p("S2", MON, 480)],
      [TUE]: [p("S1", TUE, 600), p("S2", TUE, 480)],
    });
    expect(laneByDay[MON]["S2"]).toBe(0); // earlier start -> higher
    expect(laneByDay[MON]["S1"]).toBe(1);
  });

  it("orders single-day cards within a day by earliest start", () => {
    const { laneByDay } = assignLanes([MON, TUE], {
      [MON]: [p("A", MON, 600), p("B", MON, 480)],
      [TUE]: [],
    });
    expect(laneByDay[MON]["B"]).toBe(0);
    expect(laneByDay[MON]["A"]).toBe(1);
  });
});
