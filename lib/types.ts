export interface Card {
  id: string;
  name: string;
  shortUrl: string | null;
  idList: string | null;
  idMembers: string[];
  totalMinutesWorked: number;
  /** True iff completed/locked — for a task-card, checked OR parent is Completed. */
  completed: boolean;
  /** Set iff this is a task-card (a "Tasks" checklist item); its parent card id. */
  parentCardId: string | null;
  /** Whether the checklist item is checked (task-cards only). */
  checkState: boolean;
  /** Checklist position for ordering task-cards under their parent. */
  checkPos: number | null;
}

export interface Placement {
  id: string;
  cardId: string;
  cardName: string;
  day: string; // YYYY-MM-DD
  startMinute: number;
  endMinute: number;
  /** True iff completed/locked — bar is painted & immutable. */
  completed: boolean;
  /** Set iff the plotted card is a task-card; its parent card id (for the hue). */
  parentCardId: string | null;
  /** The parent card's name, for the "{PARENT}:{TASK}" bar label (task-cards only). */
  parentName: string | null;
}

export interface Settings {
  dayStartMinute: number;
  dayEndMinute: number;
}

/** GET /api/placements response for the visible window. */
export interface WindowData {
  placements: Placement[];
  /** day (YYYY-MM-DD) -> outMinute (defaults handled client-side when absent). */
  outByDay: Record<string, number | null>;
  /** Cards that have at least one placement on ANY date (for the "plotted" marker). */
  plottedCardIds: string[];
}

/** day -> (cardId -> rowIndex). */
export type LaneMap = Record<string, Record<string, number>>;

/** One aggregated task row destined for the Google Sheet. */
export interface ExportRow {
  task: string; // parent name (task-card) or card name -> "Task" column
  description: string; // task item text (task-card) or "" -> "Description" column
  startDate: string; // earliest plotted day in range (YYYY-MM-DD)
  endDate: string; // latest plotted day in range (YYYY-MM-DD)
  actualHours: number; // sum of segment minutes / 60, 2 decimals
}

/** Result of POST /api/sheets/export. */
export interface ExportResult {
  taskCount: number;
  /** Tab title written to (absent when taskCount === 0). */
  title?: string;
  /** Deep link to the written tab (absent when taskCount === 0). */
  spreadsheetUrl?: string;
}
