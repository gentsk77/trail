import { previewKindFor } from "./destinations";
import type { InboxResult } from "./inbox";
import type {
  ActivityEvent, AgentAppId, AgentAppScan, Artifact, ConnectProject,
  ConnectResult, ConnectSelection, EvidenceEvent, Objective, Project,
  ReconRun, SessionRecord, Settings, Status, Task
} from "./types";

/* Client contract (D2): live mode talks HTTP to the sidecar; demo mode
   implements the same interface over the bundled seed. Zero code-path
   changes outside adapters. */

export interface Bootstrap {
  tasks: Task[];
  objectives: Objective[];
  sessions: SessionRecord[];
  projects: Project[];
  recons: ReconRun[];
  settings: Settings;
}

export interface TaskDetail {
  task: Task;
  activity: ActivityEvent[];
  artifacts: Artifact[];
  evidence: EvidenceEvent[];
}

export interface DispatchResult {
  pack: string;
  launched: boolean;
}

/* A tile's preview payload: a URL the client can embed (image / html
   frame) or an opening-lines excerpt; null = icon tile (refs, or no
   preview source in this mode). */
export type ArtifactPreview =
  | { kind: "image" | "html"; url: string }
  | { kind: "text"; text: string }
  | null;

/* Per-day progress (dogfood r1B): Ready is display-only signal alongside
   ratified Done; same-day ready→done collapses to one Done count. */
export interface ProgressResult {
  days: Record<string, { done: string[]; ready: string[] }>;
}

export interface TrailClient {
  readonly mode: "live" | "demo";
  bootstrap(): Promise<Bootstrap>;
  createTask(input: { title: string; description?: string; objectiveId?: string; projectId?: string; date?: string; status?: Status }): Promise<Task>;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "description" | "objectiveId" | "projectId" | "date">>): Promise<Task>;
  moveStatus(id: string, to: Status): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  taskDetail(id: string): Promise<TaskDetail>;
  inbox(): Promise<InboxResult>;
  createObjective(input: { title: string; level: 1 | 2; parentId?: string; description?: string }): Promise<Objective>;
  updateObjective(id: string, patch: Partial<Pick<Objective, "title" | "description" | "state" | "parentId">>): Promise<Objective>;
  deleteObjective(id: string): Promise<void>;
  createProject(input: { name: string; dir?: string }): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "dir">>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  connectScan(): Promise<{ apps: AgentAppScan[] }>;
  connectProjects(): Promise<{ projects: ConnectProject[] }>;
  connectApp(input: { app: AgentAppId; projects: ConnectSelection[] }): Promise<ConnectResult>;
  resolveSuggestion(sessionId: string, taskId: string, accept: boolean): Promise<void>;
  dispatch(taskId: string): Promise<DispatchResult>;
  runRecon(): Promise<ReconRun>;
  progress(): Promise<ProgressResult>;
  openArtifact(artifact: Artifact): Promise<void>;
  artifactPreview(artifact: Artifact): Promise<ArtifactPreview>;
  /* demo mode only (story 12): restore the pristine seed; absent on live */
  resetDemo?(): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export class HttpClient implements TrailClient {
  readonly mode = "live" as const;

  bootstrap() {
    return fetch("/api/bootstrap").then((r) => json<Bootstrap>(r));
  }
  createTask(input: Parameters<TrailClient["createTask"]>[0]) {
    return fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then((r) => json<Task>(r));
  }
  updateTask(id: string, patch: Parameters<TrailClient["updateTask"]>[1]) {
    /* undefined means "clear this field" here; JSON would drop the key, so it travels as null */
    const body = JSON.stringify(patch, (_k, v: unknown) => (v === undefined ? null : v));
    return fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body }).then((r) => json<Task>(r));
  }
  moveStatus(id: string, to: Status) {
    return fetch(`/api/tasks/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, by: "operator" }) }).then((r) => json<Task>(r));
  }
  deleteTask(id: string) {
    return fetch(`/api/tasks/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)).then(() => undefined);
  }
  taskDetail(id: string) {
    return fetch(`/api/tasks/${id}/detail`).then((r) => json<TaskDetail>(r));
  }
  inbox() {
    return fetch("/api/inbox").then((r) => json<InboxResult>(r));
  }
  createObjective(input: Parameters<TrailClient["createObjective"]>[0]) {
    return fetch("/api/objectives", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then((r) => json<Objective>(r));
  }
  updateObjective(id: string, patch: Parameters<TrailClient["updateObjective"]>[1]) {
    return fetch(`/api/objectives/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).then((r) => json<Objective>(r));
  }
  deleteObjective(id: string) {
    return fetch(`/api/objectives/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)).then(() => undefined);
  }
  createProject(input: Parameters<TrailClient["createProject"]>[0]) {
    return fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then((r) => json<Project>(r));
  }
  updateProject(id: string, patch: Parameters<TrailClient["updateProject"]>[1]) {
    /* undefined clears (travels as null), same as updateTask */
    const body = JSON.stringify(patch, (_k, v: unknown) => (v === undefined ? null : v));
    return fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body }).then((r) => json<Project>(r));
  }
  deleteProject(id: string) {
    return fetch(`/api/projects/${id}`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)).then(() => undefined);
  }
  connectScan() {
    return fetch("/api/connect/scan").then((r) => json<{ apps: AgentAppScan[] }>(r));
  }
  connectProjects() {
    return fetch("/api/connect/projects").then((r) => json<{ projects: ConnectProject[] }>(r));
  }
  connectApp(input: Parameters<TrailClient["connectApp"]>[0]) {
    return fetch("/api/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then((r) => json<ConnectResult>(r));
  }
  resolveSuggestion(sessionId: string, taskId: string, accept: boolean) {
    return fetch(`/api/sessions/${sessionId}/suggestion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, accept }) }).then((r) => json<void>(r));
  }
  dispatch(taskId: string) {
    return fetch(`/api/tasks/${taskId}/dispatch`, { method: "POST" }).then((r) => json<DispatchResult>(r));
  }
  runRecon() {
    return fetch("/api/recon/run", { method: "POST" }).then((r) => json<ReconRun>(r));
  }
  progress() {
    return fetch("/api/progress").then((r) => json<ProgressResult>(r));
  }
  openArtifact(artifact: Parameters<TrailClient["openArtifact"]>[0]) {
    if (artifact.href) {
      window.open(artifact.href, "_blank", "noopener");
      return Promise.resolve();
    }
    const body = JSON.stringify({ path: artifact.path, sessionId: artifact.sessionId, kind: artifact.kind, sha: artifact.sha });
    return fetch("/api/open", { method: "POST", headers: { "content-type": "application/json" }, body }).then(() => undefined);
  }
  async artifactPreview(artifact: Artifact): Promise<ArtifactPreview> {
    if (artifact.kind !== "file" || !artifact.path) return null;
    const url = `/api/artifacts/preview?path=${encodeURIComponent(artifact.path)}`;
    const kind = previewKindFor(artifact.path);
    if (kind !== "text") return { kind, url };
    const res = await fetch(`${url}&excerpt=1`);
    if (!res.ok) return null;
    return { kind: "text", text: await res.text() };
  }
  subscribe(onChange: () => void) {
    const es = new EventSource("/api/events");
    es.onmessage = () => onChange();
    return () => es.close();
  }
}
