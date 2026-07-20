import { describe, expect, it } from "vitest";
import type { SessionRecord, Task } from "../src/lib/types";
import { applyBackdate, importBurstIds, planBackdate } from "../server/harvester/backdate";

/* Dogfood r1B §1 migration: import-burst tasks with a linked session get
   createdAt rewritten from the session's startedAt; everything else is
   untouched; a second run plans nothing. */

const task = (id: string, createdAt: string, linked: string[] = []): Task => ({
  id, title: `t-${id}`, status: "ready",
  createdAt, updatedAt: createdAt, linkedSessionIds: linked
});

const session = (id: string, startedAt: string): SessionRecord => ({
  id, projectDir: "D:/x", storeDir: "x", file: `${id}.jsonl`,
  startedAt, lastActiveAt: startedAt, liveStatus: "closed",
  suggestions: [], harvestState: "heuristic", imported: true
});

/* 12 tasks created ~200ms apart inside one minute = a burst */
const burstTasks = Array.from({ length: 12 }, (_, i) =>
  task(`b${i}`, `2026-07-15T19:26:${String(i).padStart(2, "0")}.000Z`, i < 10 ? [`s${i}`] : [])
);
const burstSessions = Array.from({ length: 10 }, (_, i) =>
  session(`s${i}`, `2026-0${(i % 2) + 6}-1${i % 10}T09:00:00.000Z`)
);

describe("importBurstIds", () => {
  it("flags a ≥10 run of near-simultaneous createdAt, not spread-out tasks", () => {
    const spread = [
      task("op1", "2026-06-01T08:00:00.000Z"),
      task("op2", "2026-06-14T10:30:00.000Z"),
      task("op3", "2026-07-02T16:45:00.000Z")
    ];
    const ids = importBurstIds([...spread, ...burstTasks]);
    expect(burstTasks.every((t) => ids.has(t.id))).toBe(true);
    expect(spread.some((t) => ids.has(t.id))).toBe(false);
  });

  it("does not flag a short run", () => {
    const few = Array.from({ length: 5 }, (_, i) => task(`f${i}`, `2026-07-15T19:26:0${i}.000Z`));
    expect(importBurstIds(few).size).toBe(0);
  });
});

describe("planBackdate", () => {
  it("rewrites burst tasks from their session's startedAt; skips unlinked ones", () => {
    const plans = planBackdate(burstTasks, burstSessions);
    expect(plans).toHaveLength(10);
    for (const p of plans) {
      const s = burstSessions.find((x) => x.id === `s${p.taskId.slice(1)}`);
      expect(p.to).toBe(s?.startedAt);
    }
    expect(plans.some((p) => p.taskId === "b10" || p.taskId === "b11")).toBe(false);
  });

  it("never touches tasks outside a burst even when they link a session", () => {
    const lone = task("lone", "2026-06-05T09:00:00.000Z", ["s0"]);
    expect(planBackdate([lone], burstSessions)).toHaveLength(0);
  });

  it("uses the earliest startedAt when several sessions link", () => {
    const multi = burstTasks.map((t) => (t.id === "b0" ? { ...t, linkedSessionIds: ["s1", "s0"] } : t));
    const starts = [burstSessions[0].startedAt, burstSessions[1].startedAt].sort();
    const plan = planBackdate(multi, burstSessions).find((p) => p.taskId === "b0");
    expect(plan?.to).toBe(starts[0]);
  });

  it("is idempotent: after applying, a second plan is empty", () => {
    const plans = planBackdate(burstTasks, burstSessions);
    const migrated = applyBackdate(burstTasks, plans);
    expect(planBackdate(migrated, burstSessions)).toHaveLength(0);
  });
});

describe("applyBackdate", () => {
  it("rewrites only createdAt and only for planned tasks", () => {
    const plans = planBackdate(burstTasks, burstSessions);
    const migrated = applyBackdate(burstTasks, plans);
    const b0 = migrated.find((t) => t.id === "b0");
    expect(b0?.createdAt).toBe(burstSessions[0].startedAt);
    expect(b0?.updatedAt).toBe(burstTasks[0].updatedAt);
    expect(migrated.find((t) => t.id === "b10")?.createdAt).toBe(burstTasks[10].createdAt);
  });
});
