import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { trelloEnv, deriveCompleted } from "@/lib/env";
import { extractTasks, type TrelloChecklist } from "@/lib/tasks";
import type { Card } from "@/lib/types";

const API = "https://api.trello.com/1";

// Reference an INSERT's excluded column inside onConflictDoUpdate.
const excluded = (column: string) => sql.raw(`excluded.${column}`);

interface TrelloCard {
  id: string;
  name: string;
  shortUrl: string;
  idList: string;
  idMembers: string[];
  checklists?: TrelloChecklist[];
}

async function trelloGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { key, token } = trelloEnv();
  const qs = new URLSearchParams({ key, token, ...params });
  const res = await fetch(`${API}${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch the configured board's cards + their "Tasks" checklists, filter to the
 *  configured lists + member, and upsert the cache (cards and task-cards). */
export async function fetchInProgressCards(): Promise<Card[]> {
  const { boardId, listIds, memberId } = trelloEnv();
  const all = await trelloGet<TrelloCard[]>(`/boards/${boardId}/cards`, {
    fields: "name,shortUrl,idList,idMembers",
    checklists: "all",
    checklist_fields: "name",
    checkItem_fields: "name,state,pos",
  });

  const filtered = all.filter(
    (c) =>
      (listIds.length === 0 || listIds.includes(c.idList)) &&
      (!memberId || (c.idMembers ?? []).includes(memberId)),
  );

  // Cards + their task-cards, upserted with a uniform column set.
  const values = [
    ...filtered.map((c) => ({
      id: c.id,
      name: c.name,
      shortUrl: c.shortUrl,
      idList: c.idList,
      idMembers: c.idMembers ?? [],
      parentCardId: null as string | null,
      checkState: false,
      checkPos: null as number | null,
    })),
    ...filtered.flatMap(extractTasks).map((t) => ({
      id: t.id,
      name: t.name,
      shortUrl: null as string | null,
      idList: null as string | null,
      idMembers: [] as string[],
      parentCardId: t.parentCardId,
      checkState: t.checkState,
      checkPos: t.checkPos,
    })),
  ];

  if (values.length) {
    await db
      .insert(cards)
      .values(values)
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          name: excluded("name"),
          shortUrl: excluded("short_url"),
          idList: excluded("id_list"),
          idMembers: excluded("id_members"),
          parentCardId: excluded("parent_card_id"),
          checkState: excluded("check_state"),
          checkPos: excluded("check_pos"),
          lastSyncedAt: new Date(),
        },
      });
  }

  // Read back with totals (do NOT delete cards that may still have placements).
  // Include the shown cards and the task-cards whose parent is shown.
  const parentIds = new Set(filtered.map((c) => c.id));
  const rows = await db.select().from(cards);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .filter((r) => parentIds.has(r.id) || (r.parentCardId != null && parentIds.has(r.parentCardId)))
    .map((r) => ({
      id: r.id,
      name: r.name,
      shortUrl: r.shortUrl,
      idList: r.idList,
      idMembers: r.idMembers,
      totalMinutesWorked: r.totalMinutesWorked,
      completed: deriveCompleted({
        idList: r.idList,
        parentCardId: r.parentCardId,
        checkState: r.checkState,
        parentIdList: r.parentCardId ? (byId.get(r.parentCardId)?.idList ?? null) : null,
      }),
      parentCardId: r.parentCardId,
      checkState: r.checkState,
      checkPos: r.checkPos,
    }));
}

/** Setup helper: list the board's lists + members with their IDs. */
export async function fetchBoardMeta() {
  const { boardId } = trelloEnv();
  const [lists, members] = await Promise.all([
    trelloGet<{ id: string; name: string }[]>(`/boards/${boardId}/lists`, { fields: "name" }),
    trelloGet<{ id: string; fullName: string; username: string }[]>(
      `/boards/${boardId}/members`,
      { fields: "fullName,username" },
    ),
  ]);
  return { boardId, lists, members };
}
