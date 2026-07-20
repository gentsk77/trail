import { describe, expect, it } from "vitest";
import { deletePlan, pruneSelection, toggleAllVisible } from "../src/views/Backlog";
import type { Objective, Task } from "../src/lib/types";

/* Dogfood r1B.3: bulk selection is scoped to the task rows the list
   renders. Hidden tasks (filtered, searched away, or collapsed) leave the
   selection; objective checkboxes ride along, and since ui r3 Delete is
   the one bulk write that reaches them. */

const set = (...ids: string[]) => new Set(ids);

describe("pruneSelection", () => {
  it("drops task ids that left visibility, keeps the still-visible", () => {
    const pruned = pruneSelection(set("t1", "t2", "t3"), set("t1", "t3"), set());
    expect([...pruned].sort()).toEqual(["t1", "t3"]);
  });

  it("objective ids survive regardless of task visibility", () => {
    const pruned = pruneSelection(set("o1", "t1"), set(), set("o1", "o2"));
    expect([...pruned]).toEqual(["o1"]);
  });

  it("returns the input set unchanged so setState can no-op", () => {
    const checked = set("t1", "o1");
    expect(pruneSelection(checked, set("t1", "t2"), set("o1"))).toBe(checked);
  });
});

describe("toggleAllVisible", () => {
  it("empty selection: selects every visible task", () => {
    const next = toggleAllVisible(set(), set("t1", "t2"));
    expect([...next].sort()).toEqual(["t1", "t2"]);
  });

  it("mixed selection: completes to all visible (indeterminate-click-selects)", () => {
    const next = toggleAllVisible(set("t1"), set("t1", "t2", "t3"));
    expect([...next].sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("full selection: clears the visible tasks", () => {
    expect(toggleAllVisible(set("t1", "t2"), set("t1", "t2")).size).toBe(0);
  });

  it("objective ids and hidden tasks are never touched", () => {
    const next = toggleAllVisible(set("o1", "t1", "t2"), set("t1", "t2"));
    expect([...next]).toEqual(["o1"]);
    const grown = toggleAllVisible(set("o1"), set("t1"));
    expect([...grown].sort()).toEqual(["o1", "t1"]);
  });

  it("no visible tasks: a vacuous select-all changes nothing", () => {
    expect([...toggleAllVisible(set("o1"), set())]).toEqual(["o1"]);
  });
});

/* ui r3: Delete reaches objectives, and the confirm has to say what
   survives — tasks under a deleted objective unassign, children promote. */

const task = (id: string, objectiveId?: string): Task => ({
  id, title: `t-${id}`, status: "planned", objectiveId,
  createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:00:00.000Z",
  linkedSessionIds: []
});
const objective = (id: string, parentId?: string): Objective => ({
  id, title: `o-${id}`, level: parentId ? 2 : 1, parentId,
  state: "planned", createdAt: "2026-07-15T10:00:00.000Z"
});

describe("deletePlan", () => {
  it("tasks alone: the count, and nothing else moves", () => {
    const plan = deletePlan(["t1", "t2"], [], [task("t1"), task("t2")], []);
    expect(plan.summary).toBe("2 tasks");
    expect(plan.consequence).toBe("Nothing else will change.");
  });

  it("singular and plural, objectives before tasks", () => {
    expect(deletePlan(["t1"], [], [task("t1")], []).summary).toBe("1 task");
    expect(deletePlan([], ["o1"], [], [objective("o1")]).summary).toBe("1 objective");
    expect(deletePlan(["t1"], ["o1", "o2"], [task("t1")], [objective("o1"), objective("o2")]).summary)
      .toBe("2 objectives and 1 task");
  });

  it("names the tasks that unassign and the children that promote", () => {
    const plan = deletePlan(
      [],
      ["o1"],
      [task("t1", "o1"), task("t2", "o1"), task("t3", "other")],
      [objective("o1"), objective("o2", "o1")]
    );
    expect(plan.consequence).toBe(
      "2 tasks will stay in the backlog, unassigned. 1 child objective will move to the top level."
    );
  });

  it("rows already selected are not survivors — no double-count", () => {
    const plan = deletePlan(
      ["t1"],
      ["o1", "o2"],
      [task("t1", "o1"), task("t2", "o1")],
      [objective("o1"), objective("o2", "o1")]
    );
    /* t1 and the child o2 die on their own account; only t2 survives */
    expect(plan.summary).toBe("2 objectives and 1 task");
    expect(plan.consequence).toBe("1 task will stay in the backlog, unassigned.");
  });

  it("an empty objective takes nothing with it", () => {
    const plan = deletePlan([], ["o1"], [task("t1", "other")], [objective("o1")]);
    expect(plan.consequence).toBe("Nothing else will change.");
  });
});
