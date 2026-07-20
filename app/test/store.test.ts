import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../server/store/db";

let dir: string;
let store: Store;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "trail-store-"));
  store = new Store(dir);
  await store.load();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("round-trips tasks across a reload", async () => {
    const task = await store.createTask({ title: "Ship adapter", date: "2026-07-15" }, "operator");
    const reloaded = new Store(dir);
    await reloaded.load();
    expect(reloaded.getTask(task.id)?.title).toBe("Ship adapter");
    expect(reloaded.listActivity(task.id).map((a) => a.kind)).toEqual(["created"]);
  });

  it("deleteTask removes the task, unlinks its sessions, and survives a reload (dogfood r5)", async () => {
    const task = await store.createTask({ title: "retire me" }, "operator");
    await store.upsertSession({
      id: "s-del", projectDir: "D:/x", storeDir: "d", file: "s.jsonl",
      startedAt: "2026-07-15T08:00:00Z", lastActiveAt: "2026-07-15T09:00:00Z",
      liveStatus: "closed", suggestions: [], harvestState: "heuristic", imported: false
    });
    await store.linkSession(task.id, "s-del", "operator");
    await store.deleteTask(task.id);
    expect(store.getTask(task.id)).toBeUndefined();
    expect(store.getSession("s-del")?.taskId).toBeUndefined();
    await expect(store.deleteTask(task.id)).rejects.toThrow(/no task/);
    const reloaded = new Store(dir);
    await reloaded.load();
    expect(reloaded.getTask(task.id)).toBeUndefined();
    expect(reloaded.getSession("s-del")?.taskId).toBeUndefined();
  });

  it("lets the operator move any status, Done included (D11)", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.moveStatus(task.id, "done", "operator");
    expect(store.getTask(task.id)?.status).toBe("done");
  });

  it("rejects automation setting Done (D8) but allows Ready", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await expect(store.moveStatus(task.id, "done", "automation")).rejects.toThrow(/never sets Done/);
    await store.moveStatus(task.id, "ready", "automation");
    expect(store.getTask(task.id)?.status).toBe("ready");
  });

  it("logs every status transition to the activity trail", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.moveStatus(task.id, "running", "automation");
    await store.moveStatus(task.id, "ready", "automation");
    await store.moveStatus(task.id, "done", "operator");
    const moves = store.listActivity(task.id).filter((a) => a.kind === "status");
    expect(moves.map((m) => [m.from, m.to, m.by])).toEqual([
      ["planned", "running", "automation"],
      ["running", "ready", "automation"],
      ["ready", "done", "operator"]
    ]);
  });

  it("logs field edits to the activity trail; no-op patches log nothing", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.updateTask(task.id, { title: "sharper title" });
    await store.updateTask(task.id, { title: "sharper title" });
    await store.updateTask(task.id, { description: "why it matters", date: "2026-07-16" });
    const edits = store.listActivity(task.id).filter((a) => a.kind === "updated");
    expect(edits.map((e) => e.note)).toEqual(["title", "description,date"]);
    expect(edits.every((e) => e.by === "operator")).toBe(true);
  });

  it("treats null patch values as clears (HTTP JSON drops undefined keys)", async () => {
    const project = await store.createProject({ name: "x", dir: "D:/repos/x" });
    const task = await store.createTask({ title: "t", projectId: project.id }, "operator");
    await store.updateTask(task.id, { projectId: null } as never);
    expect(store.getTask(task.id)?.projectId).toBeUndefined();
    await store.updateTask(task.id, { projectId: null } as never);
    const edits = store.listActivity(task.id).filter((a) => a.kind === "updated");
    expect(edits.map((e) => e.note)).toEqual(["projectId"]);
  });

  it("stamps statusAt on create and on every status move, not on field edits", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    expect(task.statusAt).toBe(task.createdAt);
    await store.updateTask(task.id, { title: "sharper" });
    expect(store.getTask(task.id)?.statusAt).toBe(task.createdAt);
    const moved = await store.moveStatus(task.id, "running", "operator");
    expect(moved.statusAt).toBe(moved.updatedAt);
    expect(moved.statusAt).not.toBe(task.createdAt);
  });

  it("projects: find by storeDir/dir; re-connect keeps a rename, refreshes the dir", async () => {
    const created = await store.ensureConnectedProject("d-slug", "D:/repos/x");
    expect(created.name).toBe("x");
    await store.updateProject(created.id, { name: "Rescue X" });
    const reconnected = await store.ensureConnectedProject("d-slug", "D:/repos/x-moved");
    expect(reconnected.id).toBe(created.id);
    expect(reconnected.name).toBe("Rescue X");
    expect(reconnected.dir).toBe("D:/repos/x-moved");
    /* a manual project with the dir gets adopted instead of duplicated */
    const manual = await store.createProject({ name: "Manual", dir: "D:/repos/y" });
    const adopted = await store.ensureConnectedProject("y-slug", "D:/repos/y");
    expect(adopted.id).toBe(manual.id);
    expect(adopted.storeDir).toBe("y-slug");
  });

  it("projects artifacts as files + PRs only, deduped — commits stay evidence (dogfood r3)", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.upsertSession({
      id: "s1", projectDir: "D:/x", storeDir: "d", file: "s1.jsonl",
      startedAt: "2026-07-15T00:00:00Z", lastActiveAt: "2026-07-15T00:10:00Z",
      liveStatus: "closed", suggestions: [], harvestState: "heuristic", imported: true
    });
    await store.linkSession(task.id, "s1", "automation");
    await store.appendEvidence([
      { sessionId: "s1", kind: "commit-ref", payload: { sha: "abcdef1234567" }, source: { file: "s1.jsonl", line: 4 }, gen: "g1", at: "2026-07-15T00:05:00Z" },
      { sessionId: "s1", kind: "pr-ref", payload: { url: "https://github.com/x/y/pull/9", label: "#9" }, source: { file: "s1.jsonl", line: 6 }, gen: "g1", at: "2026-07-15T00:06:00Z" },
      /* the same PR harvested again dedupes by url */
      { sessionId: "s1", kind: "pr-ref", payload: { url: "https://github.com/x/y/pull/9", label: "#9" }, source: { file: "s1.jsonl", line: 8 }, gen: "g1", at: "2026-07-15T00:07:00Z" }
    ]);
    const artifacts = store.artifactsForTask(task.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ kind: "pr", href: "https://github.com/x/y/pull/9" });
    /* the commit is still evidence — recon proof, timeline row — just not a tile */
    expect(store.listEvidence({ sessionId: "s1" }).some((e) => e.kind === "commit-ref")).toBe(true);
  });

  it("projects file refs as artifacts, deduped by path; preview gate knows them", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.upsertSession({
      id: "s1", projectDir: "D:/x", storeDir: "d", file: "s1.jsonl",
      startedAt: "2026-07-15T00:00:00Z", lastActiveAt: "2026-07-15T00:10:00Z",
      liveStatus: "closed", suggestions: [], harvestState: "heuristic", imported: true
    });
    await store.linkSession(task.id, "s1", "automation");
    await store.appendEvidence([
      { sessionId: "s1", kind: "file-ref", payload: { path: "D:/x/notes.md", tool: "Write" }, source: { file: "s1.jsonl", line: 4 }, gen: "g1", at: "2026-07-15T00:05:00Z" },
      /* same file touched again (case differs): one tile, latest wins */
      { sessionId: "s1", kind: "file-ref", payload: { path: "D:/X/notes.md", tool: "Edit" }, source: { file: "s1.jsonl", line: 9 }, gen: "g1", at: "2026-07-15T00:08:00Z" }
    ]);
    const files = store.artifactsForTask(task.id).filter((a) => a.kind === "file");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ label: "notes.md", at: "2026-07-15T00:08:00Z" });
    expect(store.hasEvidenceFile("D:/x/notes.md")).toBe(true);
    expect(store.hasEvidenceFile("D:/x/secrets.env")).toBe(false);
  });
});

/* ui r2: projects can be deleted; their tasks unassign rather than die,
   and a connected project's storeDir returns to the exclusion list so
   the watcher does not resurrect it. */
describe("deleteProject (ui r2)", () => {
  it("removes the project, unassigns only its tasks, and survives a reload", async () => {
    const gone = await store.createProject({ name: "lab", dir: "D:/repos/lab", storeDir: "c--repos-lab" });
    const kept = await store.createProject({ name: "keep" });
    const mine = await store.createTask({ title: "mine", projectId: gone.id }, "operator");
    const other = await store.createTask({ title: "other", projectId: kept.id }, "operator");
    await store.deleteProject(gone.id);
    expect(store.getProject(gone.id)).toBeUndefined();
    expect(store.getTask(mine.id)?.projectId).toBeUndefined();
    expect(store.getTask(other.id)?.projectId).toBe(kept.id);
    const reloaded = new Store(dir);
    await reloaded.load();
    expect(reloaded.getProject(gone.id)).toBeUndefined();
    expect(reloaded.getTask(mine.id)?.projectId).toBeUndefined();
    expect(reloaded.getTask(other.id)?.projectId).toBe(kept.id);
  });

  it("returns a connected project's storeDir to the exclusion list; folderless deletes leave settings alone", async () => {
    const connected = await store.createProject({ name: "lab", dir: "D:/repos/lab", storeDir: "c--repos-lab" });
    await store.deleteProject(connected.id);
    expect(store.getSettings().excludedStoreDirs).toContain("c--repos-lab");
    const folderless = await store.createProject({ name: "errands" });
    const before = store.getSettings().excludedStoreDirs;
    await store.deleteProject(folderless.id);
    expect(store.getSettings().excludedStoreDirs).toEqual(before);
  });

  it("404s on an unknown project", async () => {
    await expect(store.deleteProject("nope")).rejects.toThrow(/no project/);
  });
});

/* ui r3: objectives can be deleted; nothing under one dies with it —
   tasks unassign and children promote to level 1, since the tree only
   roots from level 1 and an orphan would render nowhere. */
describe("deleteObjective (ui r3)", () => {
  it("promotes children, unassigns only its tasks, and survives a reload", async () => {
    const gone = await store.createObjective({ title: "gone", level: 1 });
    const kept = await store.createObjective({ title: "kept", level: 1 });
    const child = await store.createObjective({ title: "child", level: 2, parentId: gone.id });
    const mine = await store.createTask({ title: "mine", objectiveId: gone.id }, "operator");
    const other = await store.createTask({ title: "other", objectiveId: kept.id }, "operator");
    await store.deleteObjective(gone.id);

    const reloaded = new Store(dir);
    await reloaded.load();
    for (const s of [store, reloaded]) {
      expect(s.listObjectives().find((o) => o.id === gone.id)).toBeUndefined();
      const promoted = s.listObjectives().find((o) => o.id === child.id);
      expect(promoted?.level).toBe(1);
      expect(promoted?.parentId).toBeUndefined();
      expect(s.getTask(mine.id)?.objectiveId).toBeUndefined();
      expect(s.getTask(other.id)?.objectiveId).toBe(kept.id);
    }
  });

  it("deleting a child leaves its parent alone", async () => {
    const parent = await store.createObjective({ title: "parent", level: 1 });
    const child = await store.createObjective({ title: "child", level: 2, parentId: parent.id });
    await store.deleteObjective(child.id);
    expect(store.listObjectives().map((o) => o.id)).toEqual([parent.id]);
    expect(store.listObjectives()[0].level).toBe(1);
  });

  it("404s on an unknown objective", async () => {
    await expect(store.deleteObjective("nope")).rejects.toThrow(/no objective/);
  });
});
