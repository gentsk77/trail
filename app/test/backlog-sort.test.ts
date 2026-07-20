import { describe, expect, it } from "vitest";
import type { Task } from "../src/lib/types";
import { taskCmp } from "../src/views/Backlog";

/* Dogfood r1B §1: the Backlog comparator must order by the day the row
   DISPLAYS (task.date, else the createdAt day) — never raw createdAt,
   which collapses to arbitrary import order when every imported task
   shares one burst minute. */

const task = (id: string, date: string | undefined, createdAt: string, title = `t-${id}`): Task => ({
  id, title, date, createdAt,
  status: "ready", updatedAt: createdAt, linkedSessionIds: []
});

/* dates span weeks; createdAt spans one import minute, deliberately in an
   order that contradicts the dates */
const burst = [
  task("a", "2026-07-10", "2026-07-15T19:26:01.000Z"),
  task("b", "2026-06-03", "2026-07-15T19:26:02.000Z"),
  task("c", "2026-07-01", "2026-07-15T19:26:03.000Z"),
  task("d", "2026-06-20", "2026-07-15T19:26:04.000Z")
];

const day = (t: Task) => t.date ?? t.createdAt.slice(0, 10);

describe("taskCmp", () => {
  it("Oldest first renders ascending by displayed day despite burst createdAt", () => {
    const sorted = [...burst].sort(taskCmp("oldest"));
    expect(sorted.map(day)).toEqual(["2026-06-03", "2026-06-20", "2026-07-01", "2026-07-10"]);
  });

  it("Newest first is the exact reverse", () => {
    const asc = [...burst].sort(taskCmp("oldest")).map((t) => t.id);
    const desc = [...burst].sort(taskCmp("newest")).map((t) => t.id);
    expect(desc).toEqual([...asc].reverse());
  });

  it("undated tasks fall back to their createdAt day", () => {
    const undated = task("u", undefined, "2026-06-10T09:00:00.000Z");
    const sorted = [task("v", "2026-06-11", "2026-07-15T19:26:05.000Z"), undated].sort(taskCmp("oldest"));
    expect(sorted.map((t) => t.id)).toEqual(["u", "v"]);
  });

  it("same day: createdAt tiebreaks in the sort direction", () => {
    const early = task("e", "2026-07-01", "2026-07-01T08:00:00.000Z");
    const late = task("l", "2026-07-01", "2026-07-01T17:00:00.000Z");
    expect([late, early].sort(taskCmp("oldest")).map((t) => t.id)).toEqual(["e", "l"]);
    expect([early, late].sort(taskCmp("newest")).map((t) => t.id)).toEqual(["l", "e"]);
  });

  it("identical day and createdAt: title keeps order stable and direction-independent", () => {
    const x = task("x", "2026-07-01", "2026-07-15T19:26:06.000Z", "alpha");
    const y = task("y", "2026-07-01", "2026-07-15T19:26:06.000Z", "beta");
    expect([y, x].sort(taskCmp("oldest")).map((t) => t.id)).toEqual(["x", "y"]);
    expect([y, x].sort(taskCmp("newest")).map((t) => t.id)).toEqual(["x", "y"]);
  });
});
