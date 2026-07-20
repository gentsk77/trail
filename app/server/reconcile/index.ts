import { randomUUID } from "node:crypto";
import type { ReconRun, Verdict } from "../../src/lib/types";
import type { Store } from "../store/db";

/* Reconciliation (R6): at day boundaries and on demand, every task planned
   for the day resolves confirmed / claimed-unverified / open; evidence
   matching no task is drift. All of it is stored and queryable; v0 renders
   per-day ready + done only (D12, revised r1B). Rollovers are recorded,
   never auto-redated (R7 deferred, 2026-07-15). */

/* task dates are local YYYY-MM-DD; timestamps are ISO — compare in the
   operator's local time, where the sidecar runs */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function runRecon(store: Store, day: string): Promise<ReconRun> {
  const results: ReconRun["results"] = [];
  const rollovers: string[] = [];

  for (const task of store.listTasks()) {
    if (task.date !== day || task.status === "shelved") continue;
    const evidence = store
      .listEvidence()
      .filter((e) => e.taskId === task.id || task.linkedSessionIds.includes(e.sessionId));
    const claimed =
      task.status === "done" ||
      task.status === "ready" ||
      evidence.some((e) => e.kind === "outcome-claim");
    /* proof is evidence, not the display strip (dogfood r3 narrowed the
       artifact projection to files + PRs; commits still verify a claim) */
    const proof = evidence.some((e) => e.kind === "commit-ref" || e.kind === "pr-ref" || e.kind === "file-ref");

    let verdict: Verdict;
    if (claimed && proof) verdict = "confirmed";
    else if (claimed) verdict = "claimed-unverified";
    else {
      verdict = "open";
      rollovers.push(task.id);
    }
    results.push({ taskId: task.id, verdict });
  }

  const drift: ReconRun["drift"] = store
    .listSessions()
    .filter((s) => !s.taskId && localDay(s.lastActiveAt) === day)
    .map((s) => ({ sessionId: s.id, title: s.title ?? s.firstPrompt?.slice(0, 60) }));

  const run: ReconRun = { id: randomUUID(), day, at: new Date().toISOString(), results, drift, rollovers };
  await store.saveRecon(run);
  return run;
}

/* progress by day (dogfood r1B): Ready joins Done as rendered progress.
   Done keeps its rule — the day of the latest move to Done, only while
   still Done. Ready is display-only signal (D8/D11 untouched): the day of
   the latest move INTO Ready, only while the task still stands at Ready
   or Done; leaving Ready anywhere but Done withdraws it. A task that
   reached Ready and Done the same day counts once, as Done. */
export interface DayProgress {
  done: string[];
  ready: string[];
}

export function progressByDay(store: Store): Record<string, DayProgress> {
  /* the task's own day wins (dogfood r3, amends D15): heat answers "what
     moved on that day's work", so a batch sign-off tonight must not
     teleport two weeks of imported work onto today. One count per task,
     under its current status, on task.date — undated tasks fall back to
     the day the current status landed. */
  const out: Record<string, DayProgress> = {};
  const bucket = (day: string) => (out[day] ??= { done: [], ready: [] });
  for (const task of store.listTasks()) {
    if (task.status !== "ready" && task.status !== "done") continue;
    const day = task.date ?? localDay(task.statusAt ?? task.createdAt);
    bucket(day)[task.status].push(task.id);
  }
  return out;
}

/* day boundary: make sure yesterday resolved even if nobody clicked */
export function startReconTimer(store: Store): () => void {
  const ensure = async () => {
    const yesterday = localDay(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (!store.listRecons().some((r) => r.day === yesterday)) {
      await runRecon(store, yesterday);
    }
  };
  void ensure();
  const timer = setInterval(() => void ensure(), Number(process.env.TRAIL_RECON_MS ?? 60 * 60 * 1000));
  return () => clearInterval(timer);
}
