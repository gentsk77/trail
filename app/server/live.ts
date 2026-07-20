import { stat } from "node:fs/promises";
import type { SessionSource } from "./adapters/sessions/types";
import { liveStatusFrom } from "./adapters/sessions/types";
import { ensureTaskForSession, isTrailInternal } from "./connect";
import { HarvestQueue, harvestSession } from "./harvester";
import type { Store } from "./store/db";

/* Live status (R8): the watcher harvests changed sessions; a sweep keeps
   idle sessions honest. Automation moves a linked task Running / Waiting /
   Ready (on close with an outcome claim) — and never Done (D8), never
   touches a task the operator put in Done or Shelved.

   With Claude Code connected (settings flow), new sessions are tracked —
   except in excluded projects (left unselected at import, r1B): unseen
   directories register as projects, unlinked sessions become tasks
   (automation-created, ceiling Ready). Dispatch-marked sessions always
   track; they are operator-initiated wherever they run. */

export async function applyLiveStatus(store: Store, sessionId: string): Promise<void> {
  const session = store.getSession(sessionId);
  if (!session?.taskId) return;
  const task = store.getTask(session.taskId);
  if (!task || task.status === "done" || task.status === "shelved") return;

  let target: typeof task.status | null = null;
  if (session.liveStatus === "running") target = "running";
  else if (session.liveStatus === "waiting") {
    /* content decides between the two waits (dogfood r5, amends D20.1's
       clock-side): a completed turn that claims an outcome and asks
       nothing is a finished lap — Ready for sign-off now, not after the
       30-minute close. A question, or no claim, genuinely waits on the
       operator. The claim must ride the session's latest activity — a
       stale claim from an earlier turn proves nothing about this one. */
    const claimed = store
      .listEvidence({ sessionId: session.id })
      .some((e) => e.kind === "outcome-claim" && e.at === session.lastActiveAt);
    target = claimed && !asksQuestion(session.lastAgentMessage) ? "ready" : "waiting";
  } else if (session.liveStatus === "closed") {
    const claimed = store
      .listEvidence({ sessionId: session.id })
      .some((e) => e.kind === "outcome-claim");
    target = claimed ? "ready" : null; // no claim, no verdict — recon resolves it
  }
  /* ready is automation's ceiling: reach it, never leave it */
  if (target && task.status !== target && task.status !== "ready") {
    const note = target === "ready"
      ? `session ${session.id.slice(0, 8)} closed claiming done`
      : `session ${session.id.slice(0, 8)}`;
    await store.moveStatus(task.id, target, "automation", note);
  }
}

/* A message ends on a question when its last real character is "?" —
   trailing markdown chrome (bold stars, backticks, brackets) stripped
   so formatting can't hide it. */
function asksQuestion(text?: string): boolean {
  return /\?$/.test((text ?? "").trim().replace(/[*_`~\])\s]+$/, ""));
}

/* Does a session the watcher just saw get to enter the store? Known
   sessions keep updating (they were imported by choice); dispatch-marked
   sessions always track; otherwise the app must be connected and the
   session's project not excluded. Trail's own harvest runs never track. */
export function shouldAutoTrack(
  store: Store,
  parsed: { storeDir: string; markerTaskId?: string; firstPrompt?: string },
  known: boolean
): boolean {
  if (known) return true;
  if (isTrailInternal(parsed)) return false;
  if (parsed.markerTaskId) return true;
  const settings = store.getSettings();
  return settings.connectedApps.includes("claude-code") && !settings.excludedStoreDirs.includes(parsed.storeDir);
}

interface WatchOptions {
  /* skip re-harvesting a session more often than this */
  minHarvestGapMs?: number;
}

export function startLiveWatch(store: Store, source: SessionSource, queue: HarvestQueue, opts: WatchOptions = {}): () => void {
  const gap = opts.minHarvestGapMs ?? 10_000;
  const lastHarvest = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const connected = () => store.getSettings().connectedApps.includes("claude-code");

  const harvestFile = async (file: string) => {
    try {
      const parsed = await source.readSession(file);
      const known = store.getSession(parsed.id);
      if (!shouldAutoTrack(store, parsed, Boolean(known))) return;
      lastHarvest.set(parsed.id, Date.now());
      await harvestSession(store, parsed, { imported: known?.imported ?? connected() });
      const excluded = store.getSettings().excludedStoreDirs.includes(parsed.storeDir);
      if (connected() && !excluded) {
        if (parsed.projectDir && !store.getProjectByStoreDir(parsed.storeDir)) {
          await store.ensureConnectedProject(parsed.storeDir, parsed.projectDir);
        }
        await ensureTaskForSession(store, parsed.id, "automation");
      }
      await applyLiveStatus(store, parsed.id);
    } catch {
      /* torn write or unreadable; next change retries */
    }
  };

  const stopWatch = source.watch((file) => {
    const id = file.replace(/\\/g, "/").split("/").pop()!.replace(/\.jsonl$/, "");
    const last = lastHarvest.get(id) ?? 0;
    const wait = Math.max(1500, gap - (Date.now() - last));
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => void harvestFile(file), wait));
  });

  /* idle sweep: demote running -> waiting -> closed without new writes.
     Turn state is content, not clock (dogfood r3): a changed file gets a
     tail read; an unchanged one keeps its stored verdict. */
  const sweep = setInterval(async () => {
    for (const session of store.listSessions()) {
      try {
        const st = await stat(session.file);
        const lastActiveAt = st.mtime.toISOString();
        let awaiting = session.awaitingInput;
        if (lastActiveAt !== session.lastActiveAt && source.readTailAwaiting) {
          awaiting = (await source.readTailAwaiting(session.file)) ?? awaiting;
        }
        const liveStatus = liveStatusFrom(lastActiveAt, awaiting);
        if (liveStatus !== session.liveStatus || lastActiveAt !== session.lastActiveAt) {
          const closing = liveStatus === "closed" && session.liveStatus !== "closed";
          await store.patchSession(session.id, { lastActiveAt, liveStatus, awaitingInput: awaiting });
          if (closing) {
            // R5: one language pass at session close/idle
            const parsed = await source.readSession(session.file);
            void queue.push(parsed, session.imported).then(() => applyLiveStatus(store, session.id));
          }
          await applyLiveStatus(store, session.id);
        }
      } catch {
        /* file gone; leave the record */
      }
    }
  }, Number(process.env.TRAIL_SWEEP_MS ?? 30_000));

  return () => {
    stopWatch();
    clearInterval(sweep);
    for (const t of timers.values()) clearTimeout(t);
  };
}
