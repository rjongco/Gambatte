/** Server-only Trello configuration. Throws if a required value is missing. */
export function trelloEnv() {
  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;
  const memberId = process.env.TRELLO_MEMBER_ID;
  // One or more source lists (e.g. In-progress + For Review). Comma-separated
  // TRELLO_LIST_IDS preferred; falls back to the single TRELLO_LIST_ID.
  const listIds = (process.env.TRELLO_LIST_IDS ?? process.env.TRELLO_LIST_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Optional: the list whose cards are treated as completed (locked/painted).
  // Must also appear in TRELLO_LIST_IDS so the cards get fetched at all.
  const completedListId = process.env.TRELLO_COMPLETED_LIST_ID ?? "";
  const missing = Object.entries({ key, token, boardId })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing Trello env: ${missing.join(", ")}. See .env.example and GET /api/trello/meta.`,
    );
  }
  return { key: key!, token: token!, boardId: boardId!, listIds, memberId, completedListId };
}

/**
 * Single source of truth for the "completed" lock: a card/bar is completed iff
 * its card currently sits in the configured Completed list. Reads the env var
 * directly (never throws) so it is safe to call from any server context.
 */
export function isCompleted(idList: string | null): boolean {
  const completedListId = process.env.TRELLO_COMPLETED_LIST_ID ?? "";
  return !!completedListId && idList === completedListId;
}

/** Server-only Google Sheets configuration. Throws if a required value is missing. */
export function sheetsEnv() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const templateTitle = process.env.GOOGLE_SHEETS_TEMPLATE_TITLE || "Template";
  const missing = Object.entries({
    GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
    GOOGLE_PRIVATE_KEY: rawKey,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing Google Sheets env: ${missing.join(", ")}. See .env.example.`);
  }
  // Keys stored single-line in .env carry literal "\n" — restore real newlines.
  const privateKey = rawKey!.replace(/\\n/g, "\n");
  return { spreadsheetId: spreadsheetId!, email: email!, privateKey, templateTitle };
}
