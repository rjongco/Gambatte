import "server-only";
import { sheets as sheetsApi, auth as googleAuth, type sheets_v4 } from "@googleapis/sheets";
import { sheetsEnv } from "@/lib/env";
import { getExportRows } from "@/lib/store";
import { rangeLabel } from "@/lib/dates";
import type { ExportResult } from "@/lib/types";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function client(): sheets_v4.Sheets {
  const { email, privateKey } = sheetsEnv();
  const auth = new googleAuth.JWT({ email, key: privateKey, scopes: [SCOPE] });
  return sheetsApi({ version: "v4", auth });
}

/** Quote an A1 sheet title (single quotes inside a title are doubled). */
function a1(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}

/**
 * Export per-card work for [from, to] into a tab named after the range.
 * Duplicates the template tab (headers + formats), clears its body, and writes
 * Task / Start / End / Actual + a Variance formula. Re-running the same range
 * replaces that tab; a different range yields a new tab. The template tab and
 * any other existing data are never modified.
 */
export async function exportRange(from: string, to: string): Promise<ExportResult> {
  const { spreadsheetId, templateTitle } = sheetsEnv();
  const rows = await getExportRows(from, to);
  if (rows.length === 0) return { taskCount: 0 };

  const sheets = client();
  const title = rangeLabel(from, to);

  // Resolve template + any existing target tab by title.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const props = (meta.data.sheets ?? []).map((s) => s.properties!);
  const template = props.find((p) => p.title === templateTitle);
  if (!template) {
    throw new Error(
      `Template tab "${templateTitle}" not found in the spreadsheet. Create it (headers + column formats) or fix GOOGLE_SHEETS_TEMPLATE_TITLE.`,
    );
  }
  const existing = props.find((p) => p.title === title);

  // Replace an identical-range tab; never delete the template itself.
  const requests: sheets_v4.Schema$Request[] = [];
  if (existing && existing.sheetId !== template.sheetId) {
    requests.push({ deleteSheet: { sheetId: existing.sheetId! } });
  }
  requests.push({
    duplicateSheet: {
      sourceSheetId: template.sheetId!,
      newSheetName: title,
      insertSheetIndex: 1,
    },
  });
  const batch = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  const replies = batch.data.replies ?? [];
  const newSheetId = replies[replies.length - 1]?.duplicateSheet?.properties?.sheetId;

  // Drop any rows the template carried, then write our data.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: a1(title, "A2:H") });

  const values = rows.map((row, i) => {
    const r = i + 2; // header is row 1
    return [row.task, "", row.startDate, row.endDate, "", row.actualHours, `=E${r}-F${r}`, ""];
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1(title, "A2"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return {
    taskCount: rows.length,
    title,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${newSheetId}`,
  };
}
