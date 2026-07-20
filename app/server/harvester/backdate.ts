import type { SessionRecord, Task } from "../../src/lib/types";

/* One-time repair for import-minted createdAt (dogfood r1B §1).
   The r1 session import stamped every synthesized task with now(), so all
   277 landed inside one minute and any created-order sort collapses to
   arbitrary import order. This plans a rewrite of createdAt from the
   linked session's startedAt — the moment the work actually began.

   Pure planning/applying only; scripts/backdate-imported-tasks.ts owns
   I/O, the pre-migration backup, and the explicit npm-run gate. */

export interface BackdatePlan {
  taskId: string;
  from: string;
  to: string;
}

/* An import burst is a run of tasks created nearly back-to-back: gaps of
   ≤5s sustained across ≥10 tasks. Operator entry never does that; the r1
   import minted hundreds inside one minute. Tuned loose on purpose — a
   burst task without a linked session is skipped later anyway. */
const BURST_GAP_MS = 5_000;
const BURST_MIN_SIZE = 10;

export function importBurstIds(tasks: Task[]): Set<string> {
  const sorted = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const out = new Set<string>();
  let run: Task[] = [];
  const flush = () => {
    if (run.length >= BURST_MIN_SIZE) for (const t of run) out.add(t.id);
    run = [];
  };
  for (const task of sorted) {
    const prev = run[run.length - 1];
    if (prev && Date.parse(task.createdAt) - Date.parse(prev.createdAt) > BURST_GAP_MS) flush();
    run.push(task);
  }
  flush();
  return out;
}

/* Rewrite target: the earliest startedAt among the task's linked sessions.
   Tasks outside a burst, without a resolvable session, or already carrying
   that timestamp plan nothing — running twice plans zero the second time. */
export function planBackdate(tasks: Task[], sessions: SessionRecord[]): BackdatePlan[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const burst = importBurstIds(tasks);
  const plans: BackdatePlan[] = [];
  for (const task of tasks) {
    if (!burst.has(task.id)) continue;
    const starts = task.linkedSessionIds
      .map((id) => byId.get(id)?.startedAt)
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .sort();
    const to = starts[0];
    if (!to || to === task.createdAt) continue;
    plans.push({ taskId: task.id, from: task.createdAt, to });
  }
  return plans;
}

export function applyBackdate(tasks: Task[], plans: BackdatePlan[]): Task[] {
  const byTask = new Map(plans.map((p) => [p.taskId, p.to]));
  return tasks.map((t) => {
    const to = byTask.get(t.id);
    return to ? { ...t, createdAt: to } : t;
  });
}
