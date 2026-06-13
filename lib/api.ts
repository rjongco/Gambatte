import type { Card, ExportResult, Settings, WindowData } from "@/lib/types";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function getCards(): Promise<Card[]> {
  const data = await jsonOrThrow(await fetch("/api/trello/cards", { cache: "no-store" }));
  return data.cards;
}

export async function getSettings(): Promise<Settings> {
  return jsonOrThrow(await fetch("/api/settings", { cache: "no-store" }));
}

export async function putSettings(s: Settings): Promise<Settings> {
  return jsonOrThrow(
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    }),
  );
}

export async function getWindow(from: string, to: string): Promise<WindowData> {
  return jsonOrThrow(
    await fetch(`/api/placements?from=${from}&to=${to}`, { cache: "no-store" }),
  );
}

export async function postPlacement(input: {
  cardId: string;
  day: string;
  startMinute: number;
  endMinute: number;
}): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/placements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function patchPlacement(
  id: string,
  patch: { startMinute: number; endMinute: number },
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/placements/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
}

export async function deletePlacement(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/placements/${id}`, { method: "DELETE" }));
}

export async function postExportSheets(input: {
  from: string;
  to: string;
}): Promise<ExportResult> {
  return jsonOrThrow(
    await fetch("/api/sheets/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function putOut(day: string, outMinute: number | null): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/days/${day}/out`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outMinute }),
    }),
  );
}
