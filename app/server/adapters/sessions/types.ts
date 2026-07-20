/* Session-source contract (D2): source-shaped, not app-shaped, so the live
   store and the demo seed are indistinguishable downstream. Strictly
   read-only — nothing in this adapter ever writes under the store root. */

export interface ProjectDirInfo {
  storeDir: string; // directory name under the store root (the cwd slug)
  projectDir: string; // real path, read from the transcripts' cwd field
  sessionFiles: string[]; // absolute paths
  lastActiveAt: string;
}

export interface SessionSummary {
  id: string;
  file: string;
  storeDir: string;
  projectDir: string;
  gitBranch?: string;
  startedAt: string;
  lastActiveAt: string;
  title?: string;
  firstPrompt?: string;
  markerTaskId?: string; // [trail-task:<id>] in the first prompt (D5)
  /* false = a stillborn transcript (queued prompt, zero assistant turns):
     nothing happened in it, so connect never offers or imports it */
  hasAssistantTurns: boolean;
}

export interface LineRef {
  line: number;
}

export interface ParsedSession extends SessionSummary {
  fileRefs: ({ path: string; tool: string } & LineRef)[];
  commits: ({ sha: string; subject?: string } & LineRef)[];
  prLinks: ({ url: string; number?: number; repo?: string } & LineRef)[];
  userPrompts: ({ text: string } & LineRef)[];
  lastAssistantText?: string;
  eventCount: number;
  /* the transcript ends on a completed assistant turn (dogfood r3) */
  awaitingInput: boolean;
}

export interface SessionSource {
  root(): string;
  listProjects(): Promise<ProjectDirInfo[]>;
  /* Light pass: metadata from the head of each file + fs mtimes. */
  listSessions(storeDir: string): Promise<SessionSummary[]>;
  /* Full pass: everything the harvester consumes, with line pointers. */
  readSession(file: string): Promise<ParsedSession>;
  /* Tail pass: turn state only, for the idle sweep (dogfood r3). */
  readTailAwaiting?(file: string): Promise<boolean | undefined>;
  /* Watch for appends/new files; cb receives the absolute file path. */
  watch(cb: (file: string) => void): () => void;
}

/* Live-status heuristic: content first, clock second (dogfood r3, the
   status-lag P0). A transcript ending on a completed assistant turn is
   waiting the moment we see it — no 90s grace. The clock keeps its two
   jobs: fresh-write = running while the agent mid-work, long-idle =
   closed. Env-tunable for tests and demos. */
const RUNNING_MS = Number(process.env.TRAIL_RUNNING_MS ?? 90_000);
const CLOSED_MS = Number(process.env.TRAIL_CLOSED_MS ?? 30 * 60_000);

export function liveStatusFrom(lastActiveAt: string, awaitingInput?: boolean, now = Date.now()): "running" | "waiting" | "closed" {
  const idleMs = now - Date.parse(lastActiveAt);
  if (idleMs >= CLOSED_MS) return "closed";
  if (awaitingInput) return "waiting";
  if (idleMs < RUNNING_MS) return "running";
  return "waiting";
}

export const TASK_MARKER = /\[trail-task:([0-9a-f-]{8,})\]/i;
