import { describe, it, expect, afterEach } from "vitest";
import { trelloCreatedMs } from "./dates";
import { extractTasks } from "./tasks";
import { deriveCompleted } from "./env";

describe("trelloCreatedMs", () => {
  it("decodes the creation time from a Trello ObjectId (first 8 hex = seconds)", () => {
    // 0x6a2635ae seconds → ms
    expect(trelloCreatedMs("6a2635ae4dad6131298f714f")).toBe(0x6a2635ae * 1000);
  });

  it("orders newer ids above older ones", () => {
    const older = "6a2635ae4dad6131298f714f";
    const newer = "7a2635ae4dad6131298f714f";
    expect(trelloCreatedMs(newer)).toBeGreaterThan(trelloCreatedMs(older));
  });

  it("returns 0 for a malformed id (sorts last)", () => {
    expect(trelloCreatedMs("zzzzzzzz")).toBe(0);
  });
});

describe("extractTasks", () => {
  const card = {
    id: "P1",
    name: "Parent",
    shortUrl: "",
    idList: "L1",
    idMembers: [],
    checklists: [
      {
        id: "cl1",
        name: "Tasks",
        checkItems: [
          { id: "t1", name: "First", state: "incomplete", pos: 20 },
          { id: "t2", name: "Second", state: "complete", pos: 10 },
        ],
      },
      { id: "cl2", name: "Other", checkItems: [{ id: "x", name: "Nope", state: "incomplete", pos: 1 }] },
    ],
  };

  it("promotes only items under checklists named exactly 'Tasks'", () => {
    const tasks = extractTasks(card);
    expect(tasks.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
    expect(tasks.find((t) => t.id === "x")).toBeUndefined();
  });

  it("maps state -> checkState and carries parent id + pos", () => {
    const tasks = extractTasks(card);
    const t2 = tasks.find((t) => t.id === "t2")!;
    expect(t2).toMatchObject({ parentCardId: "P1", checkState: true, checkPos: 10 });
    const t1 = tasks.find((t) => t.id === "t1")!;
    expect(t1.checkState).toBe(false);
  });

  it("combines multiple checklists named 'Tasks'", () => {
    const two = {
      ...card,
      checklists: [
        { id: "a", name: "Tasks", checkItems: [{ id: "t1", name: "A", state: "incomplete", pos: 1 }] },
        { id: "b", name: "Tasks", checkItems: [{ id: "t2", name: "B", state: "incomplete", pos: 2 }] },
      ],
    };
    expect(extractTasks(two).map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("is case-sensitive (ignores 'tasks')", () => {
    const lower = { ...card, checklists: [{ id: "a", name: "tasks", checkItems: [{ id: "t1", name: "A", state: "incomplete", pos: 1 }] }] };
    expect(extractTasks(lower)).toEqual([]);
  });

  it("returns [] when there are no checklists", () => {
    expect(extractTasks({ id: "P" })).toEqual([]);
  });
});

describe("deriveCompleted", () => {
  afterEach(() => {
    delete process.env.TRELLO_COMPLETED_LIST_ID;
  });

  it("normal card: completed iff its own list is the Completed list", () => {
    process.env.TRELLO_COMPLETED_LIST_ID = "DONE";
    expect(deriveCompleted({ idList: "DONE", parentCardId: null, checkState: false, parentIdList: null })).toBe(true);
    expect(deriveCompleted({ idList: "L1", parentCardId: null, checkState: false, parentIdList: null })).toBe(false);
  });

  it("task-card: completed when checked, regardless of parent's list", () => {
    process.env.TRELLO_COMPLETED_LIST_ID = "DONE";
    expect(deriveCompleted({ idList: null, parentCardId: "P1", checkState: true, parentIdList: "L1" })).toBe(true);
  });

  it("task-card: completed when its parent is in the Completed list", () => {
    process.env.TRELLO_COMPLETED_LIST_ID = "DONE";
    expect(deriveCompleted({ idList: null, parentCardId: "P1", checkState: false, parentIdList: "DONE" })).toBe(true);
  });

  it("task-card: not completed when unchecked and parent not Completed", () => {
    process.env.TRELLO_COMPLETED_LIST_ID = "DONE";
    expect(deriveCompleted({ idList: null, parentCardId: "P1", checkState: false, parentIdList: "L1" })).toBe(false);
  });
});
