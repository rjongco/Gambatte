import { describe, it, expect } from "vitest";
import { resolve, clampToOut, snapIncoming, type Seg } from "./resolve";

const BOUNDS = { dayStart: 480, out: 1440 };

function seg(id: string, cardId: string, start: number, end: number): Seg {
  return { id, cardId, start, end };
}

describe("resolve - basics", () => {
  it("inserts a new bar into an empty day", () => {
    const r = resolve({ cardId: "A", start: 480, end: 540 }, [], BOUNDS);
    expect(r.toInsert).toEqual([{ cardId: "A", startMinute: 480, endMinute: 540 }]);
    expect(r.toUpdate).toEqual([]);
    expect(r.toDelete).toEqual([]);
  });

  it("snaps incoming to 30-minute marks", () => {
    const r = resolve({ cardId: "A", start: 485, end: 533 }, [], BOUNDS);
    expect(r.toInsert[0]).toMatchObject({ startMinute: 480, endMinute: 540 });
  });

  it("rejects a zero/negative or sub-30 span", () => {
    expect(() => resolve({ cardId: "A", start: 600, end: 600 }, [], BOUNDS)).toThrow();
    expect(() => resolve({ cardId: "A", start: 600, end: 500 }, [], BOUNDS)).toThrow();
  });

  it("leaves non-overlapping bars untouched", () => {
    const existing = [seg("q1", "B", 600, 660)];
    const r = resolve({ cardId: "A", start: 480, end: 540 }, existing, BOUNDS);
    expect(r.toDelete).toEqual([]);
    expect(r.toUpdate).toEqual([]);
    expect(r.toInsert).toHaveLength(1);
  });
});

describe("snapIncoming", () => {
  it("snaps + clamps an incoming span to the day's bounds", () => {
    expect(snapIncoming({ start: 485, end: 533 }, BOUNDS)).toEqual({ start: 480, end: 540 });
    // clamps below dayStart and above out
    expect(snapIncoming({ start: 400, end: 1500 }, BOUNDS)).toEqual({ start: 480, end: 1440 });
  });

  it("throws for a span at/after Out or shorter than the 30-min minimum", () => {
    expect(() => snapIncoming({ start: 1440, end: 1470 }, BOUNDS)).toThrow();
    expect(() => snapIncoming({ start: 600, end: 605 }, BOUNDS)).toThrow();
  });

  it("agrees with what resolve() would place (shared snapping)", () => {
    const span = snapIncoming({ start: 605, end: 655 }, BOUNDS);
    const r = resolve({ cardId: "A", start: 605, end: 655 }, [], BOUNDS);
    expect(r.toInsert[0]).toMatchObject({ startMinute: span.start, endMinute: span.end });
  });
});

describe("resolve - split & shrink", () => {
  it("deletes a bar fully covered by the incoming", () => {
    const existing = [seg("q1", "B", 540, 600)];
    const r = resolve({ cardId: "A", start: 480, end: 660 }, existing, BOUNDS);
    expect(r.toDelete).toEqual(["q1"]);
    expect(r.toInsert).toHaveLength(1); // incoming
  });

  it("splits an existing bar when the incoming lands inside it", () => {
    const existing = [seg("q1", "B", 480, 720)]; // 08:00-12:00
    const r = resolve({ cardId: "A", start: 540, end: 600 }, existing, BOUNDS); // 09:00-10:00
    // left half reuses q1 (08:00-09:00), right half is a new insert (10:00-12:00)
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 480, endMinute: 540 });
    expect(r.toInsert).toContainEqual({ cardId: "B", startMinute: 600, endMinute: 720 });
    expect(r.toInsert).toContainEqual({ cardId: "A", startMinute: 540, endMinute: 600 });
    expect(r.toDelete).toEqual([]);
  });

  it("truncates on a left overlap", () => {
    const existing = [seg("q1", "B", 480, 600)]; // 08:00-10:00
    const r = resolve({ cardId: "A", start: 540, end: 660 }, existing, BOUNDS); // 09:00-11:00
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 480, endMinute: 540 });
  });

  it("truncates on a right overlap", () => {
    const existing = [seg("q1", "B", 600, 720)]; // 10:00-12:00
    const r = resolve({ cardId: "A", start: 540, end: 660 }, existing, BOUNDS); // 09:00-11:00
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 660, endMinute: 720 });
  });
});

describe("resolve - out cap", () => {
  it("clamps the incoming end to out", () => {
    const r = resolve({ cardId: "A", start: 960, end: 1100 }, [], { dayStart: 480, out: 1020 });
    expect(r.toInsert[0]).toMatchObject({ startMinute: 960, endMinute: 1020 });
  });

  it("rejects an incoming that starts at or after out", () => {
    expect(() =>
      resolve({ cardId: "A", start: 1020, end: 1080 }, [], { dayStart: 480, out: 1020 }),
    ).toThrow();
  });
});

describe("resolve - same-card merge", () => {
  it("merges a new same-card bar touching an existing one", () => {
    const existing = [seg("q1", "A", 480, 540)]; // 08:00-09:00
    const r = resolve({ cardId: "A", start: 540, end: 600 }, existing, BOUNDS); // 09:00-10:00
    // touching same card -> q1 grows to 08:00-10:00, no new insert
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 480, endMinute: 600 });
    expect(r.toInsert).toEqual([]);
    expect(r.toDelete).toEqual([]);
  });

  it("does NOT merge same-card bars separated by a gap", () => {
    const existing = [seg("q1", "A", 480, 540)]; // 08:00-09:00
    const r = resolve({ cardId: "A", start: 600, end: 660 }, existing, BOUNDS); // 10:00-11:00
    expect(r.toInsert).toHaveLength(1);
    expect(r.toUpdate).toEqual([]);
  });
});

describe("resolve - editing an existing placement", () => {
  it("moves a bar, excluding itself from conflict resolution", () => {
    const existing = [seg("self", "A", 480, 540), seg("q1", "B", 600, 720)];
    // move self to 10:00-11:00, overlapping q1's left edge
    const r = resolve({ id: "self", cardId: "A", start: 600, end: 660 }, existing, BOUNDS);
    expect(r.toUpdate).toContainEqual({ id: "self", startMinute: 600, endMinute: 660 });
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 660, endMinute: 720 });
  });
});

describe("clampToOut", () => {
  it("truncates bars crossing out and deletes bars fully past out", () => {
    const existing = [seg("q1", "A", 540, 1080), seg("q2", "B", 1080, 1200)];
    const r = clampToOut(existing, { dayStart: 480, out: 1020 });
    expect(r.toUpdate).toContainEqual({ id: "q1", startMinute: 540, endMinute: 1020 });
    expect(r.toDelete).toContain("q2");
  });
});
