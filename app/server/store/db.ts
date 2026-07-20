import { randomUUID } from "node:crypto";
import path from "node:path";
import { EventEmitter } from "node:events";
import type {
  ActivityEvent, Actor, Artifact, EvidenceEvent, Objective, Project,
  ReconRun, SessionRecord, Settings, Status, Task
} from "../../src/lib/types";
import { canSetStatus } from "../../src/lib/status";
import { appendJsonl, readJson, readJsonl, writeJson } from "./files";

const now = () => new Date().toISOString();

export class Store {
  readonly events = new EventEmitter();
  private tasks = new Map<string, Task>();
  private objectives = new Map<string, Objective>();
  private sessions = new Map<string, SessionRecord>();
  private projects = new Map<string, Project>(); // keyed by id (D18)
  private recons: ReconRun[] = [];
  private evidence: EvidenceEvent[] = [];
  private activity: ActivityEvent[] = [];
  private settings: Settings = { connectedApps: [], excludedStoreDirs: [] };

  constructor(private dir: string) {}

  private file(name: string) {
    return path.join(this.dir, name);
  }

  async load(): Promise<void> {
    const tasks = await readJson<Task[]>(this.file("tasks.json"), []);
    const objectives = await readJson<Objective[]>(this.file("objectives.json"), []);
    const sessions = await readJson<SessionRecord[]>(this.file("sessions.json"), []);
    const projects = await readJson<Project[]>(this.file("projects.json"), []);
    this.recons = await readJson<ReconRun[]>(this.file("recon.json"), []);
    const saved = await readJson<Partial<Settings>>(this.file("settings.json"), {});
    this.settings = {
      connectedApps: saved.connectedApps ?? [],
      excludedStoreDirs: saved.excludedStoreDirs ?? []
    };
    this.evidence = await readJsonl<EvidenceEvent>(this.file("evidence.jsonl"));
    this.activity = await readJsonl<ActivityEvent>(this.file("activity.jsonl"));
    for (const t of tasks) this.tasks.set(t.id, t);
    for (const o of objectives) this.objectives.set(o.id, o);
    for (const s of sessions) this.sessions.set(s.id, s);
    /* pre-D18 stores carry id-less entries; migrate:projects converts them */
    for (const p of projects) if (p.id) this.projects.set(p.id, p);
  }

  private emit(type: string, payload: unknown = null) {
    this.events.emit("change", { type, payload, at: now() });
  }

  private async persistTasks() {
    await writeJson(this.file("tasks.json"), [...this.tasks.values()]);
  }
  private async persistObjectives() {
    await writeJson(this.file("objectives.json"), [...this.objectives.values()]);
  }
  private async persistSessions() {
    await writeJson(this.file("sessions.json"), [...this.sessions.values()]);
  }

  /* ---------------- tasks ---------------- */

  listTasks(): Task[] {
    return [...this.tasks.values()];
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  async createTask(input: Partial<Task> & { title: string }, by: Actor): Promise<Task> {
    /* the D8/D11 ceiling holds on the creation path too: automation never births Done */
    if (!canSetStatus(by, input.status ?? "planned")) {
      throw Object.assign(new Error("automation never sets Done (D8/D11)"), { statusCode: 403 });
    }
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      objectiveId: input.objectiveId,
      projectId: input.projectId,
      date: input.date,
      status: input.status ?? "planned",
      /* import backfill passes the session's startedAt; operator creates stamp now */
      createdAt: input.createdAt ?? now(),
      updatedAt: now(),
      statusAt: input.createdAt ?? now(),
      linkedSessionIds: []
    };
    this.tasks.set(task.id, task);
    await this.logActivity({ taskId: task.id, kind: "created", by });
    await this.persistTasks();
    this.emit("tasks");
    return task;
  }

  async updateTask(
    id: string,
    patch: Partial<Pick<Task, "title" | "description" | "objectiveId" | "projectId" | "date">>
  ): Promise<Task> {
    const task = this.mustTask(id);
    /* HTTP clears arrive as null (JSON drops undefined keys); store fields as undefined */
    const clean = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : v])
    ) as typeof patch;
    const changed = (Object.keys(clean) as (keyof typeof clean)[]).filter((k) => clean[k] !== task[k]);
    Object.assign(task, clean, { updatedAt: now() });
    if (changed.length) await this.logActivity({ taskId: id, kind: "updated", by: "operator", note: changed.join(",") });
    await this.persistTasks();
    this.emit("tasks");
    return task;
  }

  /* The status invariant lives here: one write path, automation never Done. */
  async moveStatus(id: string, to: Status, by: Actor, note?: string): Promise<Task> {
    const task = this.mustTask(id);
    if (!canSetStatus(by, to)) {
      throw Object.assign(new Error("automation never sets Done (D8/D11)"), { statusCode: 403 });
    }
    if (task.status === to) return task;
    const from = task.status;
    task.status = to;
    task.updatedAt = now();
    task.statusAt = task.updatedAt;
    await this.logActivity({ taskId: id, kind: "status", from, to, by, note });
    await this.persistTasks();
    this.emit("tasks");
    return task;
  }

  async setDispatch(id: string, packPath: string): Promise<Task> {
    const task = this.mustTask(id);
    task.dispatch = { packPath, at: now() };
    task.updatedAt = now();
    await this.logActivity({ taskId: id, kind: "dispatched", by: "operator" });
    await this.persistTasks();
    this.emit("tasks");
    return task;
  }

  async linkSession(taskId: string, sessionId: string, by: Actor, note?: string): Promise<void> {
    const task = this.mustTask(taskId);
    if (!task.linkedSessionIds.includes(sessionId)) {
      task.linkedSessionIds.push(sessionId);
      task.updatedAt = now();
      await this.logActivity({ taskId, kind: "linked", by, note: note ?? sessionId });
      await this.persistTasks();
    }
    const session = this.sessions.get(sessionId);
    if (session && session.taskId !== taskId) {
      session.taskId = taskId;
      await this.persistSessions();
    }
    this.emit("tasks");
    this.emit("sessions");
  }

  /* Delete is the operator retiring a task outright (dogfood r5). The
     append-only logs keep their rows — history stays evidence — but the
     task goes and its sessions unlink. */
  async deleteTask(id: string): Promise<void> {
    const task = this.mustTask(id);
    this.tasks.delete(task.id);
    let unlinked = false;
    for (const session of this.sessions.values()) {
      if (session.taskId === task.id) {
        session.taskId = undefined;
        unlinked = true;
      }
    }
    await this.persistTasks();
    if (unlinked) await this.persistSessions();
    this.emit("tasks");
    if (unlinked) this.emit("sessions");
  }

  private mustTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw Object.assign(new Error(`no task ${id}`), { statusCode: 404 });
    return task;
  }

  /* ---------------- objectives ---------------- */

  listObjectives(): Objective[] {
    return [...this.objectives.values()];
  }

  async createObjective(input: Partial<Objective> & { title: string; level: 1 | 2 }): Promise<Objective> {
    const objective: Objective = {
      id: randomUUID(),
      level: input.level,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      state: input.state ?? "planned",
      createdAt: now()
    };
    this.objectives.set(objective.id, objective);
    await this.persistObjectives();
    this.emit("objectives");
    return objective;
  }

  async updateObjective(
    id: string,
    patch: Partial<Pick<Objective, "title" | "description" | "state" | "parentId">>
  ): Promise<Objective> {
    const objective = this.objectives.get(id);
    if (!objective) throw Object.assign(new Error(`no objective ${id}`), { statusCode: 404 });
    Object.assign(objective, patch);
    await this.persistObjectives();
    this.emit("objectives");
    return objective;
  }

  /* ui r3: nothing under an objective dies with it (deleteProject's law).
     Tasks unassign, and children promote to level 1 rather than orphan —
     the tree only roots from level 1, so a child left pointing at a gone
     parent would render nowhere. */
  async deleteObjective(id: string): Promise<void> {
    const objective = this.objectives.get(id);
    if (!objective) throw Object.assign(new Error(`no objective ${id}`), { statusCode: 404 });
    this.objectives.delete(id);
    for (const child of this.objectives.values()) {
      if (child.parentId === id) {
        child.parentId = undefined;
        child.level = 1;
      }
    }
    let unassigned = false;
    for (const task of this.tasks.values()) {
      if (task.objectiveId === id) {
        task.objectiveId = undefined;
        unassigned = true;
      }
    }
    await this.persistObjectives();
    if (unassigned) await this.persistTasks();
    this.emit("objectives");
    if (unassigned) this.emit("tasks");
  }

  /* ---------------- sessions ---------------- */

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()];
  }

  getSession(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  async upsertSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.id, record);
    await this.persistSessions();
    this.emit("sessions");
  }

  async patchSession(id: string, patch: Partial<SessionRecord>): Promise<SessionRecord | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    Object.assign(session, patch);
    await this.persistSessions();
    this.emit("sessions");
    return session;
  }

  /* ---------------- projects (first-class, D18) ---------------- */

  listProjects(): Project[] {
    return [...this.projects.values()];
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getProjectByStoreDir(storeDir: string): Project | undefined {
    return [...this.projects.values()].find((p) => p.storeDir === storeDir);
  }

  getProjectByDir(dir: string): Project | undefined {
    const key = path.resolve(dir).toLowerCase();
    return [...this.projects.values()].find((p) => p.dir && path.resolve(p.dir).toLowerCase() === key);
  }

  private async persistProjects() {
    await writeJson(this.file("projects.json"), [...this.projects.values()]);
  }

  async createProject(input: { name: string; dir?: string; storeDir?: string; source?: Project["source"] }): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      dir: input.dir,
      storeDir: input.storeDir,
      source: input.source,
      createdAt: now()
    };
    this.projects.set(project.id, project);
    await this.persistProjects();
    this.emit("projects");
    return project;
  }

  async updateProject(id: string, patch: Partial<Pick<Project, "name" | "dir">>): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) throw Object.assign(new Error(`no project ${id}`), { statusCode: 404 });
    /* HTTP clears arrive as null (JSON drops undefined keys), same as tasks */
    const clean = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : v])
    ) as typeof patch;
    if (clean.name !== undefined && !clean.name.trim()) delete clean.name; // a project never loses its name
    Object.assign(project, clean);
    await this.persistProjects();
    this.emit("projects");
    return project;
  }

  /* Delete is the operator retiring a project (ui r2, supersedes the
     D24-era no-delete note): its tasks unassign rather than die, and a
     connected project's storeDir returns to the exclusion list so the
     watcher does not resurrect it — D14's exclusions persist where no
     project points; recreating a project on the dir lifts it (D27). */
  async deleteProject(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) throw Object.assign(new Error(`no project ${id}`), { statusCode: 404 });
    this.projects.delete(id);
    let unassigned = false;
    for (const task of this.tasks.values()) {
      if (task.projectId === id) {
        task.projectId = undefined;
        unassigned = true;
      }
    }
    if (project.storeDir && !this.settings.excludedStoreDirs.includes(project.storeDir)) {
      await this.saveSettings({ excludedStoreDirs: [...this.settings.excludedStoreDirs, project.storeDir] });
    }
    await this.persistProjects();
    if (unassigned) await this.persistTasks();
    this.emit("projects");
    if (unassigned) this.emit("tasks");
  }

  /* Connect/watcher entry: find by storeDir, adopt a same-dir manual
     project, else create named by the leaf. Never clobbers a rename —
     only the dir and the connection facts refresh on re-import. */
  async ensureConnectedProject(storeDir: string, dir: string, source: Project["source"] = "claude-code"): Promise<Project> {
    const existing = this.getProjectByStoreDir(storeDir) ?? this.getProjectByDir(dir);
    if (existing) {
      const merged = { ...existing, dir, storeDir, source: existing.source ?? source };
      this.projects.set(merged.id, merged);
      await this.persistProjects();
      this.emit("projects");
      return merged;
    }
    const leaf = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
    return this.createProject({ name: leaf, dir, storeDir, source });
  }

  /* ---------------- evidence (append-only; latest harvest gen wins) ---------------- */

  private latestEvidence(): EvidenceEvent[] {
    const maxGen = new Map<string, string>();
    for (const e of this.evidence) {
      const cur = maxGen.get(e.sessionId);
      if (!cur || e.gen > cur) maxGen.set(e.sessionId, e.gen);
    }
    return this.evidence.filter((e) => e.gen === maxGen.get(e.sessionId));
  }

  listEvidence(filter?: { sessionId?: string; taskId?: string }): EvidenceEvent[] {
    return this.latestEvidence().filter(
      (e) =>
        (!filter?.sessionId || e.sessionId === filter.sessionId) &&
        (!filter?.taskId || e.taskId === filter.taskId)
    );
  }

  async appendEvidence(events: Omit<EvidenceEvent, "id">[]): Promise<EvidenceEvent[]> {
    const withIds = events.map((e) => ({ ...e, id: randomUUID() }));
    this.evidence.push(...withIds);
    await appendJsonl(this.file("evidence.jsonl"), withIds);
    this.emit("evidence");
    return withIds;
  }

  /* Artifacts are a projection of evidence: files and PR links only,
     deduped, latest touch wins (dogfood r3, amends D17's strip) — commits
     stay on the timeline, sessions carry their own side-rail field. */
  artifactsForTask(taskId: string): Artifact[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    const files = new Map<string, Artifact>();
    const prs = new Map<string, Artifact>();
    for (const e of this.latestEvidence()) {
      const linked = e.taskId === taskId || task.linkedSessionIds.includes(e.sessionId);
      if (!linked) continue;
      if (e.kind === "pr-ref") {
        const href = String(e.payload.url ?? "");
        if (!href) continue;
        prs.set(href, { kind: "pr", label: `PR ${String(e.payload.label ?? "")}`.trim(), href, sessionId: e.sessionId, at: e.at });
      } else if (e.kind === "file-ref") {
        const p = String(e.payload.path ?? "");
        if (!p) continue;
        const label = p.split(/[\\/]/).filter(Boolean).pop() ?? p;
        files.set(path.resolve(p).toLowerCase(), { kind: "file", label, path: p, sessionId: e.sessionId, at: e.at });
      }
    }
    return [...files.values(), ...prs.values()];
  }

  /* Preview gate: the sidecar serves file bytes only for paths the
     evidence log actually references — never arbitrary reads. */
  hasEvidenceFile(p: string): boolean {
    const key = path.resolve(p).toLowerCase();
    return this.latestEvidence().some(
      (e) => e.kind === "file-ref" && typeof e.payload.path === "string" && path.resolve(e.payload.path).toLowerCase() === key
    );
  }

  /* ---------------- activity (append-only) ---------------- */

  listActivity(taskId?: string): ActivityEvent[] {
    return taskId ? this.activity.filter((a) => a.taskId === taskId) : [...this.activity];
  }

  private async logActivity(input: Omit<ActivityEvent, "id" | "at">): Promise<void> {
    const event: ActivityEvent = { ...input, id: randomUUID(), at: now() };
    this.activity.push(event);
    await appendJsonl(this.file("activity.jsonl"), [event]);
  }

  /* ---------------- reconciliation ---------------- */

  listRecons(): ReconRun[] {
    return [...this.recons];
  }

  async saveRecon(run: ReconRun): Promise<void> {
    this.recons = this.recons.filter((r) => r.day !== run.day);
    this.recons.push(run);
    await writeJson(this.file("recon.json"), this.recons);
    this.emit("recon");
  }

  /* ---------------- settings ---------------- */

  getSettings(): Settings {
    return this.settings;
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch };
    await writeJson(this.file("settings.json"), this.settings);
    this.emit("settings");
    return this.settings;
  }
}
