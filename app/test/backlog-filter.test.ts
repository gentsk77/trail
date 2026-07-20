import { describe, expect, it } from "vitest";
import type { Status, Task } from "../src/lib/types";
import { filterPass } from "../src/views/Backlog";

/* UI r1: filters start empty and empty means unfiltered. A checked box
   narrows to the checked values; unchecking every box restores the full
   list. Nothing-selected never means nothing-shown. */

const task = (id: string, status: Status, projectId?: string): Task => ({
  id, title: `t-${id}`, status, projectId,
  createdAt: "2026-07-15T10:00:00.000Z", updatedAt: "2026-07-15T10:00:00.000Z",
  linkedSessionIds: []
});

const none = new Set<never>();

describe("filterPass", () => {
  it("empty filters pass every task", () => {
    for (const t of [task("a", "ready", "p1"), task("b", "done"), task("c", "shelved", "p2")]) {
      expect(filterPass(t, none, none)).toBe(true);
    }
  });

  it("a checked status narrows to that status", () => {
    const f = new Set<Status>(["ready"]);
    expect(filterPass(task("a", "ready"), f, none)).toBe(true);
    expect(filterPass(task("b", "done"), f, none)).toBe(false);
  });

  it("a checked project narrows to that project", () => {
    const f = new Set(["p1"]);
    expect(filterPass(task("a", "ready", "p1"), none, f)).toBe(true);
    expect(filterPass(task("b", "ready", "p2"), none, f)).toBe(false);
    expect(filterPass(task("c", "ready"), none, f)).toBe(false);
  });

  it('the empty-string key is "No project": matches only projectless tasks', () => {
    const f = new Set([""]);
    expect(filterPass(task("a", "ready"), none, f)).toBe(true);
    expect(filterPass(task("b", "ready", "p1"), none, f)).toBe(false);
  });

  it("status and project intersect", () => {
    const s = new Set<Status>(["ready"]);
    const p = new Set(["p1"]);
    expect(filterPass(task("a", "ready", "p1"), s, p)).toBe(true);
    expect(filterPass(task("b", "ready", "p2"), s, p)).toBe(false);
    expect(filterPass(task("c", "done", "p1"), s, p)).toBe(false);
  });
});
