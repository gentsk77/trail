import type { ArtifactPreview, Bootstrap, DispatchResult, ProgressResult, TaskDetail, TrailClient } from "../api";
import { toDay } from "../dates";
import { destinationFor } from "../destinations";
import { composeInbox, type InboxResult } from "../inbox";
import { canSetStatus } from "../status";
import { demoNotice } from "./notice";
import type {
  ActivityEvent, AgentAppScan, Artifact, ConnectProject, ConnectResult,
  EvidenceEvent, Objective, Project, ReconRun,
  Status, Task, Verdict
} from "../types";
import { buildDemoData, type DemoData } from "./seed";

/* Demo-seeded client (D2/R9): the same TrailClient contract over the
   bundled sanitized seed — zero sidecar, zero code-path changes outside
   adapters. Dispatch shows the generated context pack and replays a
   status stream (R8's demo shape). State persists to localStorage. */

/* v2: first-class projects (D18) — a v1 payload lacks projects/projectId,
   so the key bump regenerates the seed instead of loading a torn shape */
const STORE_KEY = "trail-demo-v2";

export class DemoClient implements TrailClient {
  readonly mode = "demo" as const;
  private data: DemoData;
  private listeners = new Set<() => void>();

  constructor(storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage()) {
    const saved = storage?.getItem(STORE_KEY);
    this.data = saved ? (JSON.parse(saved) as DemoData) : buildDemoData();
    this.data.previews ??= {}; /* payloads saved before previews shipped */
    this.storage = storage;
  }
  private storage: Pick<Storage, "getItem" | "setItem"> | null;

  private persist() {
    this.storage?.setItem(STORE_KEY, JSON.stringify(this.data));
    for (const cb of this.listeners) cb();
  }

  private now() {
    return new Date().toISOString();
  }

  private log(event: Omit<ActivityEvent, "id">) {
    this.data.activity.push({ ...event, id: `a-${Math.random().toString(36).slice(2, 9)}` });
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  async bootstrap(): Promise<Bootstrap> {
    return {
      tasks: [...this.data.tasks],
      objectives: [...this.data.objectives],
      sessions: [...this.data.sessions],
      projects: [...this.data.projects],
      recons: [...this.data.recons],
      settings: { connectedApps: ["claude-code"], excludedStoreDirs: [] }
    };
  }

  private mustTask(id: string): Task {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) throw new Error(`no task ${id}`);
    return task;
  }

  async createTask(input: Parameters<TrailClient["createTask"]>[0]): Promise<Task> {
    const task: Task = {
      id: `t-${Math.random().toString(36).slice(2, 9)}`,
      title: input.title,
      description: input.description,
      objectiveId: input.objectiveId,
      projectId: input.projectId,
      date: input.date,
      status: input.status ?? "planned",
      createdAt: this.now(),
      updatedAt: this.now(),
      statusAt: this.now(),
      linkedSessionIds: []
    };
    this.data.tasks.push(task);
    this.log({ taskId: task.id, kind: "created", by: "operator", at: task.createdAt });
    this.persist();
    return task;
  }

  async updateTask(id: string, patch: Parameters<TrailClient["updateTask"]>[1]): Promise<Task> {
    const task = this.mustTask(id);
    const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== task[k]);
    Object.assign(task, patch, { updatedAt: this.now() });
    if (changed.length) this.log({ taskId: id, kind: "updated", by: "operator", note: changed.join(","), at: this.now() });
    this.persist();
    return task;
  }

  async moveStatus(id: string, to: Status): Promise<Task> {
    return this.move(id, to, "operator");
  }

  private move(id: string, to: Status, by: "operator" | "automation"): Task {
    const task = this.mustTask(id);
    if (!canSetStatus(by, to)) throw new Error("automation never sets Done (D8/D11)");
    if (task.status === to) return task;
    this.log({ taskId: id, kind: "status", from: task.status, to, by, at: this.now() });
    task.status = to;
    task.updatedAt = this.now();
    task.statusAt = task.updatedAt;
    this.persist();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    this.mustTask(id);
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    for (const session of this.data.sessions) {
      if (session.taskId === id) session.taskId = undefined;
    }
    this.persist();
  }

  async taskDetail(id: string): Promise<TaskDetail> {
    const task = this.mustTask(id);
    const evidence = this.data.evidence.filter(
      (e) => e.taskId === id || task.linkedSessionIds.includes(e.sessionId)
    );
    return {
      task,
      activity: this.data.activity.filter((a) => a.taskId === id),
      artifacts: this.artifacts(evidence),
      evidence
    };
  }

  async inbox(): Promise<InboxResult> {
    return composeInbox(this.data.tasks, this.data.sessions, (taskId) => {
      const task = this.data.tasks.find((t) => t.id === taskId);
      if (!task) return [];
      return this.artifacts(
        this.data.evidence.filter((e) => e.taskId === taskId || task.linkedSessionIds.includes(e.sessionId))
      );
    });
  }

  /* mirrors the server projection (dogfood r3, amends D17's strip): files
     and PR links only, deduped — commits stay on the timeline, sessions
     carry their own side-rail field */
  private artifacts(evidence: EvidenceEvent[]): Artifact[] {
    const files: Artifact[] = [];
    const prs = new Map<string, Artifact>();
    const seenFiles = new Set<string>();
    for (const e of evidence) {
      if (e.kind === "pr-ref") {
        const href = String(e.payload.url ?? "");
        if (href) prs.set(href, { kind: "pr", label: `PR ${String(e.payload.label ?? "")}`.trim(), href, sessionId: e.sessionId, at: e.at });
      } else if (e.kind === "file-ref") {
        const p = String(e.payload.path ?? "");
        if (!p || seenFiles.has(p.toLowerCase())) continue;
        seenFiles.add(p.toLowerCase());
        const label = p.split(/[\\/]/).filter(Boolean).pop() ?? p;
        files.push({ kind: "file", label, path: p, sessionId: e.sessionId, at: e.at });
      }
    }
    return [...files, ...prs.values()]; /* files lead, matching the server projection */
  }

  async createObjective(input: Parameters<TrailClient["createObjective"]>[0]): Promise<Objective> {
    const objective: Objective = {
      id: `o-${Math.random().toString(36).slice(2, 9)}`,
      level: input.level,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      state: "planned",
      createdAt: this.now()
    };
    this.data.objectives.push(objective);
    this.persist();
    return objective;
  }

  async updateObjective(id: string, patch: Parameters<TrailClient["updateObjective"]>[1]): Promise<Objective> {
    const objective = this.data.objectives.find((o) => o.id === id);
    if (!objective) throw new Error(`no objective ${id}`);
    Object.assign(objective, patch);
    this.persist();
    return objective;
  }

  async deleteObjective(id: string): Promise<void> {
    if (!this.data.objectives.some((o) => o.id === id)) throw new Error(`no objective ${id}`);
    this.data.objectives = this.data.objectives.filter((o) => o.id !== id);
    /* children promote, tasks unassign (ui r3) — the live store's law */
    for (const child of this.data.objectives) {
      if (child.parentId === id) {
        child.parentId = undefined;
        child.level = 1;
      }
    }
    for (const task of this.data.tasks) {
      if (task.objectiveId === id) task.objectiveId = undefined;
    }
    this.persist();
  }

  async createProject(input: Parameters<TrailClient["createProject"]>[0]): Promise<Project> {
    const project: Project = {
      id: `p-${Math.random().toString(36).slice(2, 9)}`,
      name: input.name,
      dir: input.dir,
      createdAt: this.now()
    };
    this.data.projects.push(project);
    this.persist();
    return project;
  }

  async updateProject(id: string, patch: Parameters<TrailClient["updateProject"]>[1]): Promise<Project> {
    const project = this.data.projects.find((p) => p.id === id);
    if (!project) throw new Error(`no project ${id}`);
    if (patch.name !== undefined && !patch.name?.trim()) delete patch.name;
    Object.assign(project, patch);
    this.persist();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.data.projects.some((p) => p.id === id)) throw new Error(`no project ${id}`);
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    /* tasks unassign rather than die (ui r2), the live store's law */
    for (const task of this.data.tasks) {
      if (task.projectId === id) task.projectId = undefined;
    }
    this.persist();
  }

  async connectScan(): Promise<{ apps: AgentAppScan[] }> {
    const dirs = new Set(this.data.sessions.map((s) => s.storeDir));
    return {
      apps: [{
        id: "claude-code",
        name: "Claude Code",
        found: true,
        connected: true,
        importable: true,
        projectCount: dirs.size,
        sessionCount: this.data.sessions.length
      }, {
        /* the scan-only row, demoed found (D2 fiction): detection without ingest */
        id: "codex",
        name: "Codex",
        found: true,
        connected: false,
        importable: false,
        projectCount: 0,
        sessionCount: 41
      }]
    };
  }

  async connectProjects(): Promise<{ projects: ConnectProject[] }> {
    return {
      /* connect candidates are connected projects only (folderless ones
         have no session store to import from) */
      projects: this.data.projects
        .filter((p) => p.storeDir && p.dir)
        .map((p) => ({
          storeDir: p.storeDir!,
          dir: p.dir!,
          name: p.name,
          sessions: this.data.sessions
            .filter((s) => s.storeDir === p.storeDir)
            .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
            .map((s) => ({ id: s.id, label: s.title, lastActiveAt: s.lastActiveAt }))
        }))
    };
  }

  async connectApp(): Promise<ConnectResult> {
    /* the seed ships connected; nothing to scan in the browser */
    return { ok: true, projects: 0, sessionsQueued: 0 };
  }

  async resolveSuggestion(sessionId: string, taskId: string, accept: boolean): Promise<void> {
    const session = this.data.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (accept) {
      session.taskId = taskId;
      session.suggestions = [];
      const task = this.mustTask(taskId);
      if (!task.linkedSessionIds.includes(sessionId)) task.linkedSessionIds.push(sessionId);
      this.log({ taskId, kind: "linked", by: "operator", note: "operator confirmed suggestion", at: this.now() });
    } else {
      session.suggestions = session.suggestions.map((s) =>
        s.taskId === taskId ? { ...s, state: "dismissed" as const } : s
      );
    }
    this.persist();
  }

  /* R8 demo: return the generated pack; replay a status stream */
  async dispatch(taskId: string): Promise<DispatchResult> {
    const task = this.mustTask(taskId);
    /* mode parity (D2): the live dispatcher refuses folderless projects
       with this exact message — the demo never fakes a success it can't;
       the toast makes the refusal visible (story 12) */
    const dir = this.data.projects.find((p) => p.id === task.projectId)?.dir;
    if (!dir) {
      const message = "Set a project with a directory, then dispatch";
      demoNotice(message);
      throw new Error(message);
    }
    const chain: Objective[] = [];
    let cur = this.data.objectives.find((o) => o.id === task.objectiveId);
    while (cur) {
      chain.unshift(cur);
      cur = this.data.objectives.find((o) => o.id === cur?.parentId);
    }
    const why = chain.length ? chain.map((o, i) => `${"  ".repeat(i)}- ${o.title}`).join("\n") : "- (no linked objective)";
    const project = this.data.projects.find((p) => p.id === task.projectId);
    const pack = `# Task brief: ${task.title}\n\n[trail-task:${task.id}]\n\n## Task\n${task.description ?? task.title}\n\n## Why (objective chain, outermost first)\n${why}\n\n## Working directory\n${project?.dir ?? "(none)"}\n\n## Conventions\n- Work the task above in this directory.\n- When you finish, state plainly what was produced (files, commits, PRs).`;

    this.log({ taskId, kind: "dispatched", by: "operator", at: this.now() });
    const sessionId = `s-replay-${taskId.slice(-4)}`;
    const schedule = (ms: number, fn: () => void) => setTimeout(fn, ms);
    schedule(1500, () => {
      this.data.sessions.push({
        id: sessionId, projectDir: project?.dir ?? "~/demo", storeDir: project?.storeDir ?? "demo", file: `${sessionId}.jsonl`,
        startedAt: this.now(), lastActiveAt: this.now(), liveStatus: "running",
        title: task.title, taskId, suggestions: [], harvestState: "full", imported: true
      });
      task.linkedSessionIds.push(sessionId);
      this.log({ taskId, kind: "linked", by: "automation", note: "dispatch marker", at: this.now() });
      this.move(taskId, "running", "automation");
    });
    schedule(7000, () => {
      this.data.evidence.push({
        id: `e-${sessionId}`, sessionId, taskId, kind: "commit-ref",
        payload: { sha: "f3a91c7", subject: "first pass" }, source: { file: `${sessionId}.jsonl`, line: 40 },
        gen: "replay", at: this.now()
      });
      this.persist();
    });
    schedule(12000, () => {
      const s = this.data.sessions.find((x) => x.id === sessionId);
      if (s) {
        s.liveStatus = "closed";
        s.lastActiveAt = this.now();
        /* the closing summary is the ready card's fallback evidence when
           its artifact strip is empty (D25) */
        s.lastAgentMessage = `Finished the brief: worked "${task.title}" end-to-end and committed f3a91c7 (first pass). Nothing left open on my side.`;
      }
      this.data.evidence.push({
        id: `e2-${sessionId}`, sessionId, taskId, kind: "outcome-claim",
        payload: { text: "Task finished; changes committed", via: "llm" }, source: { file: `${sessionId}.jsonl`, line: 90 },
        gen: "replay", at: this.now()
      });
      this.data.evidence.push({
        id: `e3-${sessionId}`, sessionId, taskId, kind: "segment",
        payload: { label: task.title, file: `${sessionId}.jsonl` }, source: { file: `${sessionId}.jsonl`, line: 1 },
        gen: "replay", at: this.now()
      });
      this.move(taskId, "ready", "automation");
    });
    this.persist();
    return { pack, launched: false };
  }

  async runRecon(): Promise<ReconRun> {
    const dayStr = toDay(new Date());
    const results = this.data.tasks
      .filter((t) => t.date === dayStr && t.status !== "shelved")
      .map((t) => {
        const evidence = this.data.evidence.filter((e) => e.taskId === t.id || t.linkedSessionIds.includes(e.sessionId));
        const claimed = t.status === "done" || t.status === "ready" || evidence.some((e) => e.kind === "outcome-claim");
        const hasArtifacts = this.artifacts(evidence).length > 0;
        const verdict: Verdict = claimed && hasArtifacts ? "confirmed" : claimed ? "claimed-unverified" : "open";
        return { taskId: t.id, verdict };
      });
    const run: ReconRun = {
      id: `r-${Math.random().toString(36).slice(2, 9)}`,
      day: dayStr,
      at: this.now(),
      results,
      drift: this.data.sessions.filter((s) => !s.taskId && s.lastActiveAt.slice(0, 10) === dayStr).map((s) => ({ sessionId: s.id, title: s.title })),
      rollovers: results.filter((r) => r.verdict === "open").map((r) => r.taskId)
    };
    this.data.recons = [...this.data.recons.filter((r) => r.day !== dayStr), run];
    this.persist();
    return run;
  }

  /* mirrors server progressByDay (dogfood r3, amends D15): one count per
     task, under its current status, on the task's own day — undated
     tasks fall back to the day the current status landed. */
  async progress(): Promise<ProgressResult> {
    const localDay = (at: string) => toDay(new Date(at));
    const days: ProgressResult["days"] = {};
    const bucket = (day: string) => (days[day] ??= { done: [], ready: [] });
    for (const task of this.data.tasks) {
      if (task.status !== "ready" && task.status !== "done") continue;
      const day = task.date ?? localDay(task.statusAt ?? task.createdAt);
      bucket(day)[task.status].push(task.id);
    }
    return { days };
  }

  async openArtifact(artifact: Artifact): Promise<void> {
    if (artifact.href) {
      if (typeof window !== "undefined") window.open(artifact.href, "_blank", "noopener");
      return;
    }
    /* non-href destinations live on the local machine (story 12): say
       so through the notice bus — never a dead click */
    const destination = destinationFor(artifact.kind, artifact.path);
    demoNotice(
      destination === "terminal" ? "In the local app, this resumes the session in your terminal."
        : destination === "viewer" ? "In the local app, this opens in your image viewer."
          : "In the local app, this opens in your editor."
    );
  }

  /* settings-menu reset (story 12): back to the pristine story */
  async resetDemo(): Promise<void> {
    this.data = buildDemoData();
    this.persist();
  }

  /* Real renders of the seed's own file contents (never a fake): images
     and html travel as data URLs, text as its opening lines. */
  async artifactPreview(artifact: Artifact): Promise<ArtifactPreview> {
    if (artifact.kind !== "file" || !artifact.path) return null;
    const seeded = this.data.previews[artifact.path];
    if (!seeded) return null;
    if (seeded.kind === "text") return { kind: "text", text: seeded.content.slice(0, 4096) };
    const mime = seeded.kind === "html" ? "text/html" : "image/svg+xml";
    return { kind: seeded.kind, url: `data:${mime};charset=utf-8,${encodeURIComponent(seeded.content)}` };
  }
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
