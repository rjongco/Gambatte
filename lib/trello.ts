import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { trelloEnv } from "@/lib/env";
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

/** Fetch the configured board's cards, filter to the in-progress list + member, and upsert the cache. */
export async function fetchInProgressCards(): Promise<Card[]> {
  const { boardId, listIds, memberId } = trelloEnv();
  const all = await trelloGet<TrelloCard[]>(`/boards/${boardId}/cards`, {
    fields: "name,shortUrl,idList,idMembers",
  });

  const filtered = all.filter(
    (c) =>
      (listIds.length === 0 || listIds.includes(c.idList)) &&
      (!memberId || (c.idMembers ?? []).includes(memberId)),
  );

  if (filtered.length) {
    await db
      .insert(cards)
      .values(
        filtered.map((c) => ({
          id: c.id,
          name: c.name,
          shortUrl: c.shortUrl,
          idList: c.idList,
          idMembers: c.idMembers ?? [],
        })),
      )
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          name: excluded("name"),
          shortUrl: excluded("short_url"),
          idList: excluded("id_list"),
          idMembers: excluded("id_members"),
          lastSyncedAt: new Date(),
        },
      });
  }

  // Read back with totals (do NOT delete cards that may still have placements).
  const ids = new Set(filtered.map((c) => c.id));
  const rows = await db.select().from(cards);
  return rows
    .filter((r) => ids.has(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      shortUrl: r.shortUrl,
      idList: r.idList,
      idMembers: r.idMembers,
      totalMinutesWorked: r.totalMinutesWorked,
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
