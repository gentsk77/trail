import { stat } from "node:fs/promises";
import path from "node:path";
import type {
  Actor, AgentAppScan, ConnectProject, ConnectResult, ConnectSelection,
  Status, Task
} from "../../src/lib/types";
import type { ProjectDirInfo, SessionSource } from "../adapters/sessions/types";
import { TASK_MARKER } from "../adapters/sessions/types";
import { harvestSession } from "../harvester";
/* runtime-only cycle with ../live (it imports ensureTaskForSession from
   here); both sides bind lazily inside async functions */
import { applyLiveStatus } from "../live";
import { localDay } from "../reconcile";
import type { Store } from "../store/db";

/* Agent-app connect (settings flow, ruled 2026-07-15; scoped in r1B):
   connecting Claude Code imports the SELECTED project directories and the
   selected sessions within them, and leaves the watcher tracking future
   sessions in those projects. Sessions become tasks: title from the
   session, dated to last activity, unlinked to objectives; ball-in-court
   sessions land Waiting, settled ones Ready (automation's ceiling,
   D8/D11) — and content trumps the clock (D24/D30): a closed lap that
   claims an outcome and asks nothing lands Ready at import. Stillborn
   transcripts (zero assistant turns) never import (D30). Claude Code
   only in the MVP (Cowork cut).

   Backfill is windowed: only sessions active in the last 30 days are
   candidates — an all-time store is hundreds of sessions of noise.
   Windowed projects left unselected are recorded as excluded; the watcher
   skips them, so their session noise stays out of the store, the
   suggestions pool, and the harvest queue. */

const IMPORT_WINDOW_MS = Number(process.env.TRAIL_IMPORT_WINDOW_MS ?? 30 * 24 * 60 * 60_000);

/* Per-directory count of session files touched inside the window (mtime
   only — no file reads at scan time). */
async function recentCounts(scan: ProjectDirInfo[], now = Date.now()): Promise<Map<string, number>> {
  const cutoff = now - IMPORT_WINDOW_MS;
  const out = new Map<string, number>();
  for (const p of scan) {
    let n = 0;
    for (const file of p.sessionFiles) {
      try {
        if ((await stat(file)).mtimeMs >= cutoff) n += 1;
      } catch {
        /* raced delete */
      }
    }
    if (n > 0) out.set(p.storeDir, n);
  }
  return out;
}

/* Trail's own language pass runs through headless `claude -p`, which
   writes sessions into the same store. Recognize them by their opening
   instruction and keep them out of import and watch — otherwise every
   harvest spawns a phantom task. */
const HARVESTER_PROMPT_PREFIX = "You are an evidence harvester for a task tracker";

export function isTrailInternal(session: { firstPrompt?: string }): boolean {
  return session.firstPrompt?.startsWith(HARVESTER_PROMPT_PREFIX) ?? false;
}

export function leafName(dir: string): string {
  const parts = dir.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? dir;
}

export function statusForSession(liveStatus: "running" | "waiting" | "closed"): Status {
  if (liveStatus === "running") return "running";
  if (liveStatus === "waiting") return "waiting";
  return "ready";
}

export function taskTitleFrom(session: { title?: string; firstPrompt?: string }): string | undefined {
  const raw = session.title ?? session.firstPrompt;
  if (!raw) return undefined;
  const cleaned = raw.replace(TASK_MARKER, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 80 ? `${cleaned.slice(0, 79).trimEnd()}…` : cleaned;
}

/* A session with no task becomes one. Skips sessions already linked
   (dispatch marker or operator) and sessions with nothing to title.
   A taskId pointing at no stored task counts as unlinked — re-import
   heals dangling links instead of skipping them. */
export async function ensureTaskForSession(store: Store, sessionId: string, by: Actor): Promise<Task | undefined> {
  const session = store.getSession(sessionId);
  if (!session || (session.taskId && store.getTask(session.taskId))) return undefined;
  const title = taskTitleFrom(session);
  if (!title) return undefined;
  const task = await store.createTask(
    {
      title,
      projectId: store.getProjectByStoreDir(session.storeDir)?.id,
      date: localDay(session.lastActiveAt),
      status: statusForSession(session.liveStatus),
      /* the task began when the session did, not when the import ran */
      createdAt: session.startedAt
    },
    by
  );
  await store.linkSession(task.id, session.id, by, by === "operator" ? "imported from Claude Code" : "session detected");
  await store.patchSession(session.id, { suggestions: [] });
  return task;
}

/* A project the operator points at a directory is a declaration of
   interest (D27, amends D14's "exclusions persist"): adopt the matching
   Claude Code store dir onto the project and lift any connect-time
   exclusion, so the watcher tracks the directory again. Runs on every
   project save and once at boot (the invariant holds for stores written
   before the rule). No-op when the directory has no Claude Code store. */
export async function adoptStoreDirForProject(store: Store, source: SessionSource, projectId: string): Promise<void> {
  const project = store.getProject(projectId);
  if (!project?.dir) return;
  let scan: ProjectDirInfo[];
  try {
    scan = await source.listProjects();
  } catch {
    return;
  }
  const norm = (d: string) => path.resolve(d).toLowerCase();
  const hit = scan.find((p) => p.projectDir && norm(p.projectDir) === norm(project.dir!));
  if (!hit) return;
  if (project.storeDir !== hit.storeDir) {
    await store.ensureConnectedProject(hit.storeDir, project.dir);
  }
  const settings = store.getSettings();
  if (settings.excludedStoreDirs.includes(hit.storeDir)) {
    await store.saveSettings({ excludedStoreDirs: settings.excludedStoreDirs.filter((d) => d !== hit.storeDir) });
  }
}

export async function scanApps(store: Store, source: SessionSource): Promise<AgentAppScan[]> {
  const scan = await source.listProjects();
  const recent = await recentCounts(scan);
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      found: scan.length > 0,
      connected: store.getSettings().connectedApps.includes("claude-code"),
      importable: true,
      projectCount: recent.size,
      sessionCount: [...recent.values()].reduce((a, b) => a + b, 0)
    },
    await scanCodex()
  ];
}

/* Codex rides the scan honestly (dogfood r2): detection only — no adapter,
   no ingest (D14 holds, importable stays false). Session logs live under
   ~/.codex/sessions as jsonl, date-nested on newer CLI versions. The root
   parameter exists for tests; production reads the real home. */
export async function scanCodex(rootOverride?: string): Promise<AgentAppScan> {
  const os = await import("node:os");
  const path = await import("node:path");
  const { readdir } = await import("node:fs/promises");
  const root = rootOverride ?? path.join(os.homedir(), ".codex", "sessions");
  let found = false;
  let sessionCount = 0;
  const walk = async (dir: string, depth: number): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    found = true;
    for (const entry of entries) {
      if (entry.isDirectory() && depth < 4) await walk(path.join(dir, entry.name), depth + 1);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) sessionCount += 1;
    }
  };
  await walk(root, 0);
  return { id: "codex", name: "Codex", found, connected: false, importable: false, projectCount: 0, sessionCount };
}

/* The connect modal's step-2 list: windowed candidates straight from the
   scan, before anything enters the store (the store-backed /api/projects
   is empty until a first import). Trail-internal sessions never appear. */
export async function listConnectCandidates(source: SessionSource): Promise<ConnectProject[]> {
  const scan = await source.listProjects();
  const recent = await recentCounts(scan);
  const cutoff = new Date(Date.now() - IMPORT_WINDOW_MS).toISOString();
  const out: ConnectProject[] = [];
  for (const p of scan) {
    if (!recent.has(p.storeDir)) continue;
    const sessions = (await source.listSessions(p.storeDir))
      .filter((s) => s.lastActiveAt >= cutoff && !isTrailInternal(s) && s.hasAssistantTurns)
      .map((s) => ({ id: s.id, label: taskTitleFrom(s), lastActiveAt: s.lastActiveAt }));
    if (sessions.length === 0) continue;
    out.push({
      storeDir: p.storeDir,
      dir: p.projectDir,
      name: p.projectDir ? leafName(p.projectDir) : p.storeDir,
      sessions
    });
  }
  return out;
}

export async function connectClaudeCode(
  store: Store,
  source: SessionSource,
  selections: ConnectSelection[]
): Promise<ConnectResult> {
  const settings = store.getSettings();
  if (!settings.connectedApps.includes("claude-code")) {
    await store.saveSettings({ connectedApps: [...settings.connectedApps, "claude-code"] });
  }
  const cutoff = new Date(Date.now() - IMPORT_WINDOW_MS).toISOString();
  /* The selection universe is exactly what the picker showed: candidate
     projects with at least one real (non-internal) windowed session. */
  const candidates = await listConnectCandidates(source);
  const byDir = new Map(selections.map((s) => [s.storeDir, s]));

  /* Candidate projects left unselected are excluded: out of this import,
     and the watcher skips their future sessions. Re-imports redefine the
     set for current candidates; an old exclusion whose sessions aged out
     of the window carries forward — D14's exclusions persist. */
  const candidateDirs = new Set(candidates.map((c) => c.storeDir));
  const excludedStoreDirs = [
    ...candidates.map((c) => c.storeDir).filter((d) => !byDir.has(d)),
    ...store.getSettings().excludedStoreDirs.filter((d) => !candidateDirs.has(d))
  ];
  await store.saveSettings({ excludedStoreDirs });

  const chosen = candidates.filter((c) => byDir.has(c.storeDir));
  let projects = 0;
  for (const c of chosen) {
    if (!c.dir) continue;
    await store.ensureConnectedProject(c.storeDir, c.dir);
    projects += 1;
  }

  const toImport: string[] = [];
  for (const c of chosen) {
    const wanted = byDir.get(c.storeDir)!.sessionIds;
    const wantedSet = wanted ? new Set(wanted) : null;
    for (const summary of await source.listSessions(c.storeDir)) {
      if (summary.lastActiveAt < cutoff || isTrailInternal(summary) || !summary.hasAssistantTurns) continue;
      if (wantedSet && !wantedSet.has(summary.id)) continue;
      toImport.push(summary.file);
    }
  }

  /* Import runs in the background; rows and tasks appear over SSE.
     Heuristic pass only — no language pass on backfill: its main
     output (link suggestions) is moot when each session becomes its
     own task, and a windowed store is still hundreds of headless
     claude runs. Watched sessions keep their close-time pass (R5). */
  void (async () => {
    for (const file of toImport) {
      try {
        const parsed = await source.readSession(file);
        await harvestSession(store, parsed, { imported: true });
        await ensureTaskForSession(store, parsed.id, "operator");
        /* content decides the birth column too (D24): a closed lap that
           claims an outcome and asks nothing lands Ready, not Waiting —
           the clock-only statusForSession is just the starting point */
        await applyLiveStatus(store, parsed.id);
      } catch {
        /* unreadable session; skip */
      }
    }
  })();

  return { ok: true, projects, sessionsQueued: toImport.length };
}
