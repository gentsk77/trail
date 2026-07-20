/* Shared domain types (client + server). Vocabulary per PRD v1.2 + D8/D11. */

export type Status = "planned" | "running" | "waiting" | "ready" | "done" | "shelved";
export type Actor = "operator" | "automation";
export type Verdict = "confirmed" | "claimed-unverified" | "open";

export interface Objective {
  id: string;
  level: 1 | 2;
  parentId?: string; // L2 -> its L1
  title: string;
  description?: string;
  state: "planned" | "done";
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  objectiveId?: string;
  projectId?: string; // first-class project reference (D18)
  date?: string; // YYYY-MM-DD
  status: Status;
  createdAt: string;
  updatedAt: string;
  /* when the task entered its current status; Inbox orders on this
     (updatedAt moves on field edits, so it cannot carry the queue).
     Optional: pre-D18 stores backfill via migrate:projects. */
  statusAt?: string;
  dispatch?: { packPath: string; at: string };
  linkedSessionIds: string[];
}

/* Task-detail activity timeline; every status transition and field edit
   is recorded ("updated" carries the changed field names in note). */
export interface ActivityEvent {
  id: string;
  taskId: string;
  kind: "created" | "status" | "updated" | "dispatched" | "linked" | "evidence";
  from?: Status;
  to?: Status;
  by: Actor;
  note?: string;
  at: string;
}

/* Append-only, session-derived, with source pointers (R3/R5). */
export type EvidenceKind =
  | "first-prompt" | "title" | "file-ref" | "commit-ref" | "pr-ref"
  | "outcome-claim" | "friction" | "lesson" | "segment";

export interface EvidenceEvent {
  id: string;
  sessionId: string;
  taskId?: string;
  kind: EvidenceKind;
  payload: Record<string, unknown>;
  source: { file: string; line: number };
  /* harvest generation: the on-disk log stays append-only; readers see only
     each session's latest generation, so re-harvest is idempotent. */
  gen: string;
  at: string;
}

export interface LinkSuggestion {
  taskId: string;
  confidence: number; // 0..1
  reason?: string;
  state: "pending" | "accepted" | "dismissed";
}

export interface SessionRecord {
  id: string;
  projectDir: string; // real cwd from the transcript
  storeDir: string; // slug dir under the session store root
  file: string;
  startedAt: string;
  lastActiveAt: string;
  liveStatus: "running" | "waiting" | "closed";
  /* the transcript ends on a completed assistant turn — the ball is the
     operator's (dogfood r3); drives waiting without the idle grace */
  awaitingInput?: boolean;
  title?: string;
  firstPrompt?: string;
  /* the agent's last message, clamped — the Inbox waiting card's body
     (D17); refreshes on every harvest of the session */
  lastAgentMessage?: string;
  taskId?: string; // deterministic (dispatch marker) or operator-confirmed
  suggestions: LinkSuggestion[];
  harvestState: "none" | "heuristic" | "full" | "heuristic-only";
  imported: boolean;
}

/* Reconciliation output — all verdicts stored; Progress renders ready +
   done (dogfood r1B, revising D12's completed-only cut).
   Rollovers stored, never auto-redated (R7 deferred, 2026-07-15). */
export interface ReconRun {
  id: string;
  day: string; // YYYY-MM-DD
  at: string;
  results: { taskId: string; verdict: Verdict }[];
  drift: { sessionId: string; title?: string }[];
  rollovers: string[];
}

/* Derived, detail-only rendering of evidence (D8: artifacts never in lists). */
export interface Artifact {
  kind: "commit" | "pr" | "session" | "file";
  label: string;
  href?: string;
  path?: string;
  sha?: string; // commit kind: the harvested sha, for remote-URL resolution (dogfood r2)
  sessionId: string;
  at: string;
}

/* A project, first-class (D18): editable name, optional working
   directory — folderless projects (errands, plans) sit beside connected
   repos. The connect flow and watcher create connected projects (named by
   the directory leaf, renamable); the operator creates the rest. */
export interface Project {
  id: string;
  name: string; // editable; connected projects arrive named by dir leaf
  dir?: string; // real working directory; absent = folderless
  storeDir?: string; // session-store slug; present on connected projects
  source?: AgentAppId; // present when the connect flow created it
  createdAt: string;
}


/* Agent-app connections (settings flow). Connecting an app imports its
   projects and past sessions and watches future ones. Claude Code only in
   the MVP (Cowork cut, ruled 2026-07-15); other apps may appear in the
   scan as detection-only rows (dogfood r2). */
export type AgentAppId = "claude-code";
export type ScannedAppId = AgentAppId | "codex";

export interface AgentAppScan {
  id: ScannedAppId;
  name: string;
  found: boolean;
  connected: boolean;
  importable: boolean; // scan-only vendors stay false until an adapter lands
  projectCount: number;
  sessionCount: number;
}

/* Pre-import candidates (connect modal step 2): what the scan found inside
   the backfill window, before anything enters the store. Labels come from
   the session title, falling back to the first prompt. */
export interface ConnectSession {
  id: string;
  label?: string;
  lastActiveAt: string;
}

export interface ConnectProject {
  storeDir: string;
  dir: string;
  name: string;
  sessions: ConnectSession[];
}

/* One selected project in an import request. sessionIds present only when
   the operator pruned sessions; absent means every candidate session. */
export interface ConnectSelection {
  storeDir: string;
  sessionIds?: string[];
}

export interface ConnectResult {
  ok: boolean;
  projects: number;
  sessionsQueued: number;
}

export interface Settings {
  connectedApps: AgentAppId[];
  /* storeDirs left unselected at the last import; the watcher does not
     auto-track new sessions in them (dispatch-marked sessions still track) */
  excludedStoreDirs: string[];
}
