import { snapTo30 } from "./time";

export interface Seg {
  id?: string;
  cardId: string;
  start: number;
  end: number;
  /** When true, the segment is a completed (locked/painted) bar. Callers may use
   *  this to keep it out of resolve()'s `existing`; resolve() itself ignores it. */
  completed?: boolean;
}

export interface Bounds {
  dayStart: number;
  out: number;
}

export interface ResolveResult {
  toInsert: { cardId: string; startMinute: number; endMinute: number }[];
  toUpdate: { id: string; startMinute: number; endMinute: number }[];
  toDelete: string[];
}

export const MIN_DURATION = 30;

export class ResolveError extends Error {}

/** Internal working segment with optional provenance id. */
interface WSeg {
  id?: string;
  cardId: string;
  start: number;
  end: number;
}

/** Merge touching same-card segments; prefer keeping an existing id. */
function mergeSameCard(segs: WSeg[]): { merged: WSeg[]; mergedAway: string[] } {
  const sorted = [...segs].sort((a, b) => a.start - b.start);
  const merged: WSeg[] = [];
  const mergedAway: string[] = [];
  for (const cur of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && prev.cardId === cur.cardId && prev.end === cur.start) {
      prev.end = cur.end;
      if (!prev.id && cur.id) prev.id = cur.id;
      else if (prev.id && cur.id) mergedAway.push(cur.id);
    } else {
      merged.push({ ...cur });
    }
  }
  return { merged, mergedAway };
}

/** Carve out [s, e) from q, returning the surviving sub-segments (0, 1 or 2). */
function carve(q: WSeg, s: number, e: number): WSeg[] {
  const parts: WSeg[] = [];
  if (q.start < s) parts.push({ id: q.id, cardId: q.cardId, start: q.start, end: Math.min(q.end, s) });
  if (q.end > e) {
    const rightStart = Math.max(q.start, e);
    // The second surviving piece is always a fresh segment (no id reuse).
    parts.push({ cardId: q.cardId, start: rightStart, end: q.end });
  }
  // If the first part didn't reuse q.id (i.e. q was entirely to the right of e),
  // let the single surviving part keep q.id.
  if (parts.length === 1 && parts[0].id === undefined) parts[0].id = q.id;
  return parts.filter((p) => p.end > p.start);
}

function clampSeg(seg: WSeg, { dayStart, out }: Bounds): WSeg | null {
  const start = Math.max(seg.start, dayStart);
  const end = Math.min(seg.end, out);
  if (end - start <= 0) return null;
  return { ...seg, start, end };
}

/** Diff a final desired segment list against the existing rows. */
function diff(result: WSeg[], existing: Seg[], mergedAway: string[]): ResolveResult {
  const existingById = new Map(existing.filter((e) => e.id).map((e) => [e.id!, e]));
  const retained = new Set<string>();
  const toInsert: ResolveResult["toInsert"] = [];
  const toUpdate: ResolveResult["toUpdate"] = [];

  for (const seg of result) {
    if (seg.id) {
      retained.add(seg.id);
      const orig = existingById.get(seg.id);
      if (!orig || orig.start !== seg.start || orig.end !== seg.end) {
        toUpdate.push({ id: seg.id, startMinute: seg.start, endMinute: seg.end });
      }
    } else {
      toInsert.push({ cardId: seg.cardId, startMinute: seg.start, endMinute: seg.end });
    }
  }

  const toDelete = existing
    .filter((e) => e.id && !retained.has(e.id))
    .map((e) => e.id!);
  for (const id of mergedAway) if (!toDelete.includes(id)) toDelete.push(id);

  return { toInsert, toUpdate, toDelete };
}

/**
 * Snap + clamp + validate an incoming span against the day's bounds. Shared by
 * resolve() and the overlap pre-checks in the store so the span tested for a
 * completed-bar collision is exactly the span that would be placed.
 */
export function snapIncoming(
  incoming: { start: number; end: number },
  bounds: Bounds,
): { start: number; end: number } {
  const { dayStart, out } = bounds;
  const start = Math.max(snapTo30(incoming.start), dayStart);
  const end = Math.min(snapTo30(incoming.end), out);
  if (start >= out) throw new ResolveError("Bar starts at or after the Out time.");
  if (end - start < MIN_DURATION) throw new ResolveError("Bar is shorter than the 30-minute minimum.");
  return { start, end };
}

/**
 * Place/move/resize `incoming` against `existing` (all placements on that day),
 * enforcing one-task-per-instant via split & shrink, the Out cap, and same-card merge.
 */
export function resolve(incoming: Seg, existing: Seg[], bounds: Bounds): ResolveResult {
  const { start: s, end: e } = snapIncoming(incoming, bounds);

  const result: WSeg[] = [{ id: incoming.id, cardId: incoming.cardId, start: s, end: e }];

  for (const q of existing) {
    if (incoming.id && q.id === incoming.id) continue; // editing self
    for (const part of carve({ id: q.id, cardId: q.cardId, start: q.start, end: q.end }, s, e)) {
      result.push(part);
    }
  }

  const clamped = result.map((seg) => clampSeg(seg, bounds)).filter((x): x is WSeg => x !== null);
  const { merged, mergedAway } = mergeSameCard(clamped);
  return diff(merged, existing, mergedAway);
}

/** Re-clamp a whole day to a (possibly lowered) Out time, without a new bar. */
export function clampToOut(existing: Seg[], bounds: Bounds): ResolveResult {
  const clamped = existing
    .map((q) => clampSeg({ id: q.id, cardId: q.cardId, start: q.start, end: q.end }, bounds))
    .filter((x): x is WSeg => x !== null);
  const { merged, mergedAway } = mergeSameCard(clamped);
  return diff(merged, existing, mergedAway);
}
