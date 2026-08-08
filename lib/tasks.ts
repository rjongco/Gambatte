/** Pure helpers for promoting Trello "Tasks" checklist items to task-cards.
 *  Kept free of server-only imports so it is unit-testable. */

export interface TrelloCheckItem {
  id: string;
  name: string;
  state: string; // "complete" | "incomplete"
  pos: number;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: TrelloCheckItem[];
}

/** A checklist item promoted to a plottable task-card row. */
export interface TaskRow {
  id: string;
  name: string;
  parentCardId: string;
  checkState: boolean;
  checkPos: number;
}

/** Flatten the items of every checklist named exactly "Tasks" (case-sensitive,
 *  duplicates combined) into task-card rows. */
export function extractTasks(card: { id: string; checklists?: TrelloChecklist[] }): TaskRow[] {
  return (card.checklists ?? [])
    .filter((cl) => cl.name === "Tasks")
    .flatMap((cl) =>
      (cl.checkItems ?? []).map((it) => ({
        id: it.id,
        name: it.name,
        parentCardId: card.id,
        checkState: it.state === "complete",
        checkPos: it.pos,
      })),
    );
}
