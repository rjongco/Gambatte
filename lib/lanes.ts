import type { LaneMap } from "./types";

export interface LanePlacement {
  cardId: string;
  day: string;
  startMinute: number;
}

export interface LaneResult {
  laneByDay: LaneMap;
  laneCount: number;
}

/**
 * Assign a row index per card across the visible window.
 * - A card is "spanning" if it has segments on >=2 of the visible days.
 * - Spanning cards take the top rows (earliest-start first), pinned to the same
 *   row in every day cell.
 * - Single-day cards fill the rows below, assigned per day independently,
 *   ordered earliest-start.
 */
export function assignLanes(
  visibleDays: string[],
  placementsByDay: Record<string, LanePlacement[]>,
): LaneResult {
  // Earliest start per card (across window) + which visible days it appears on.
  const earliestStart = new Map<string, number>();
  const daysForCard = new Map<string, Set<string>>();
  for (const day of visibleDays) {
    for (const pl of placementsByDay[day] ?? []) {
      const prev = earliestStart.get(pl.cardId);
      if (prev === undefined || pl.startMinute < prev) earliestStart.set(pl.cardId, pl.startMinute);
      if (!daysForCard.has(pl.cardId)) daysForCard.set(pl.cardId, new Set());
      daysForCard.get(pl.cardId)!.add(day);
    }
  }

  const spanning: string[] = [];
  for (const [cardId, days] of daysForCard) if (days.size >= 2) spanning.push(cardId);
  spanning.sort((a, b) => earliestStart.get(a)! - earliestStart.get(b)!);

  const spanningRow = new Map<string, number>();
  spanning.forEach((cardId, i) => spanningRow.set(cardId, i));
  const base = spanning.length;

  const laneByDay: LaneMap = {};
  let maxRows = base;

  for (const day of visibleDays) {
    laneByDay[day] = {};
    // Spanning cards reserve their row in every cell.
    for (const [cardId, row] of spanningRow) laneByDay[day][cardId] = row;

    const singles = (placementsByDay[day] ?? [])
      .filter((pl) => !spanningRow.has(pl.cardId))
      .reduce<string[]>((acc, pl) => {
        if (!acc.includes(pl.cardId)) acc.push(pl.cardId);
        return acc;
      }, []);
    singles.sort((a, b) => earliestStart.get(a)! - earliestStart.get(b)!);
    singles.forEach((cardId, i) => (laneByDay[day][cardId] = base + i));
    maxRows = Math.max(maxRows, base + singles.length);
  }

  return { laneByDay, laneCount: maxRows };
}
