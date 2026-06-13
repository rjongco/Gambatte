import "server-only";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { placements, daySettings, appSettings, cards } from "@/db/schema";
import { resolve, clampToOut, type Seg, type ResolveResult, type Bounds } from "@/lib/resolve";
import type { ExportRow, Placement, Settings, WindowData } from "@/lib/types";

/** Ensure the singleton settings row exists, return it. */
export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (rows.length) {
    return { dayStartMinute: rows[0].dayStartMinute, dayEndMinute: rows[0].dayEndMinute };
  }
  const [created] = await db
    .insert(appSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return { dayStartMinute: created.dayStartMinute, dayEndMinute: created.dayEndMinute };
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  return { dayStartMinute: row.dayStartMinute, dayEndMinute: row.dayEndMinute };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await getSettings(); // ensure row
  await db.update(appSettings).set(patch).where(eq(appSettings.id, 1));
  return getSettings();
}

export async function getOutMinute(day: string): Promise<number | null> {
  const rows = await db.select().from(daySettings).where(eq(daySettings.day, day));
  return rows.length ? rows[0].outMinute : null;
}

export async function setOutMinute(day: string, outMinute: number | null): Promise<void> {
  await db
    .insert(daySettings)
    .values({ day, outMinute })
    .onConflictDoUpdate({ target: daySettings.day, set: { outMinute } });
}

/** Effective bounds for a day: dayStart + (per-day Out ?? dayEnd). */
export async function boundsForDay(day: string): Promise<Bounds> {
  const settings = await getSettings();
  const out = await getOutMinute(day);
  return { dayStart: settings.dayStartMinute, out: out ?? settings.dayEndMinute };
}

/** Raw placements for a single day, shaped for resolve(). */
export async function getDaySegs(day: string): Promise<Seg[]> {
  const rows = await db.select().from(placements).where(eq(placements.day, day));
  return rows.map((r) => ({ id: r.id, cardId: r.cardId, start: r.startMinute, end: r.endMinute }));
}

/** Placements (joined with card name) + Out times for a date window. */
export async function getWindowData(from: string, to: string): Promise<WindowData> {
  const rows = await db
    .select({
      id: placements.id,
      cardId: placements.cardId,
      cardName: cards.name,
      day: placements.day,
      startMinute: placements.startMinute,
      endMinute: placements.endMinute,
    })
    .from(placements)
    .innerJoin(cards, eq(placements.cardId, cards.id))
    .where(and(gte(placements.day, from), lte(placements.day, to)));

  const dayRows = await db
    .select()
    .from(daySettings)
    .where(and(gte(daySettings.day, from), lte(daySettings.day, to)));

  const outByDay: Record<string, number | null> = {};
  for (const d of dayRows) outByDay[d.day] = d.outMinute;

  const plotted = await db
    .selectDistinct({ cardId: placements.cardId })
    .from(placements);
  const plottedCardIds = plotted.map((p) => p.cardId);

  return { placements: rows as Placement[], outByDay, plottedCardIds };
}

/** Apply a ResolveResult for a day in one transaction, then recompute affected totals. */
export async function applyResult(day: string, result: ResolveResult): Promise<void> {
  const affected = new Set<string>();
  await db.transaction(async (tx) => {
    if (result.toDelete.length) {
      const del = await tx
        .delete(placements)
        .where(inArray(placements.id, result.toDelete))
        .returning({ cardId: placements.cardId });
      del.forEach((r) => affected.add(r.cardId));
    }
    for (const u of result.toUpdate) {
      const [row] = await tx
        .update(placements)
        .set({ startMinute: u.startMinute, endMinute: u.endMinute, updatedAt: new Date() })
        .where(eq(placements.id, u.id))
        .returning({ cardId: placements.cardId });
      if (row) affected.add(row.cardId);
    }
    if (result.toInsert.length) {
      await tx
        .insert(placements)
        .values(result.toInsert.map((i) => ({ ...i, day })));
      result.toInsert.forEach((i) => affected.add(i.cardId));
    }
  });
  await recomputeTotals([...affected]);
}

/** Recompute cards.totalMinutesWorked across ALL days for the given cards. */
export async function recomputeTotals(cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  for (const cardId of cardIds) {
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(${placements.endMinute} - ${placements.startMinute}), 0)` })
      .from(placements)
      .where(eq(placements.cardId, cardId));
    await db.update(cards).set({ totalMinutesWorked: Number(total) }).where(eq(cards.id, cardId));
  }
}

/** High-level ops used by routes. */
export async function placeBar(input: {
  cardId: string;
  day: string;
  startMinute: number;
  endMinute: number;
}): Promise<void> {
  const bounds = await boundsForDay(input.day);
  const existing = await getDaySegs(input.day);
  const result = resolve(
    { cardId: input.cardId, start: input.startMinute, end: input.endMinute },
    existing,
    bounds,
  );
  await applyResult(input.day, result);
}

export async function editBar(
  id: string,
  patch: { startMinute: number; endMinute: number },
): Promise<void> {
  const [row] = await db.select().from(placements).where(eq(placements.id, id));
  if (!row) throw new Error("Placement not found");
  const bounds = await boundsForDay(row.day);
  const existing = await getDaySegs(row.day);
  const result = resolve(
    { id, cardId: row.cardId, start: patch.startMinute, end: patch.endMinute },
    existing,
    bounds,
  );
  await applyResult(row.day, result);
}

export async function deleteBar(id: string): Promise<void> {
  const [row] = await db
    .delete(placements)
    .where(eq(placements.id, id))
    .returning({ cardId: placements.cardId });
  if (row) await recomputeTotals([row.cardId]);
}

/**
 * Aggregate per-card work for an inclusive [from, to] date range: one row per
 * card with ≥1 placement in range. startDate/endDate = earliest/latest plotted
 * day; actualHours = total plotted minutes / 60 (2 decimals). Ordered by start.
 */
export async function getExportRows(from: string, to: string): Promise<ExportRow[]> {
  const rows = await db
    .select({
      task: cards.name,
      startDate: sql<string>`min(${placements.day})`,
      endDate: sql<string>`max(${placements.day})`,
      totalMinutes: sql<number>`sum(${placements.endMinute} - ${placements.startMinute})`,
    })
    .from(placements)
    .innerJoin(cards, eq(placements.cardId, cards.id))
    .where(and(gte(placements.day, from), lte(placements.day, to)))
    .groupBy(placements.cardId, cards.name)
    .orderBy(sql`min(${placements.day})`);

  return rows.map((r) => ({
    task: r.task,
    startDate: r.startDate,
    endDate: r.endDate,
    actualHours: Math.round((Number(r.totalMinutes) / 60) * 100) / 100,
  }));
}

export async function applyOut(day: string, outMinute: number | null): Promise<void> {
  await setOutMinute(day, outMinute);
  const bounds = await boundsForDay(day);
  const existing = await getDaySegs(day);
  const result = clampToOut(existing, bounds);
  await applyResult(day, result);
}
