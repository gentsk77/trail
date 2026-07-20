import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LiveSessionSource } from "../server/adapters/sessions/live";
import { connectClaudeCode, ensureTaskForSession, isTrailInternal, listConnectCandidates, scanApps, scanCodex, statusForSession, taskTitleFrom } from "../server/connect";
import { Store } from "../server/store/db";
import type { SessionRecord } from "../src/lib/types";
import { fixtureSession, fixtureStillbornSession } from "./fixtures";

let dataDir: string;
let storeRoot: string;
let store: Store;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-connect-data-"));
  storeRoot = mkdtempSync(path.join(tmpdir(), "trail-connect-root-"));
  store = new Store(dataDir);
  await store.load();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(storeRoot, { recursive: true, force: true });
});

function writeSession(storeDir: string, sessionId: string, opts: { cwd: string; firstPrompt: string; title?: string; mtime?: Date; lastText?: string; stillborn?: boolean }) {
  const dir = path.join(storeRoot, storeDir);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.jsonl`);
  const body = opts.stillborn
    ? fixtureStillbornSession({ sessionId, cwd: opts.cwd, firstPrompt: opts.firstPrompt })
    : fixtureSession({ sessionId, cwd: opts.cwd, firstPrompt: opts.firstPrompt, title: opts.title, lastText: opts.lastText });
  writeFileSync(file, body, "utf8");
  // backdate mtime so the session reads as settled (closed), not running
  const old = opts.mtime ?? new Date(Date.now() - 60 * 60_000 * 24);
  utimesSync(file, old, old);
}

function seededRecord(patch: Partial<SessionRecord>): SessionRecord {
  return {
    id: "s1", projectDir: "D:/repos/new-folder", storeDir: "d", file: "s1.jsonl",
    startedAt: "2026-07-14T08:00:00Z", lastActiveAt: "2026-07-14T09:30:00Z",
    liveStatus: "closed", suggestions: [], harvestState: "heuristic", imported: true,
    ...patch
  };
}

describe("session-to-task mapping (connect flow)", () => {
  it("maps live status to task status: waiting stays Waiting, settled lands Ready", () => {
    expect(statusForSession("running")).toBe("running");
    expect(statusForSession("waiting")).toBe("waiting");
    expect(statusForSession("closed")).toBe("ready");
  });

  it("titles from the session, falling back to the first prompt, marker stripped", () => {
    expect(taskTitleFrom({ title: "Fix the parser" })).toBe("Fix the parser");
    expect(taskTitleFrom({ firstPrompt: "please  fix\nthe parser" })).toBe("please fix the parser");
    expect(taskTitleFrom({ firstPrompt: "[trail-task:0123abcd] do the thing" })).toBe("do the thing");
    expect(taskTitleFrom({})).toBeUndefined();
  });

  it("creates an unlinked-to-objective task dated to last activity and links the session", async () => {
    const project = await store.ensureConnectedProject("d", "D:/repos/new-folder");
    await store.upsertSession(seededRecord({ title: "Rework the onboarding doc" }));
    const task = await ensureTaskForSession(store, "s1", "operator");
    expect(task).toBeDefined();
    expect(task!.title).toBe("Rework the onboarding doc");
    expect(task!.objectiveId).toBeUndefined();
    expect(task!.status).toBe("ready");
    expect(task!.date).toBe("2026-07-14");
    expect(task!.projectId).toBe(project.id);
    expect(store.getSession("s1")?.taskId).toBe(task!.id);
    // import-synthesized tasks inherit the session's startedAt, never the import time
    expect(task!.createdAt).toBe("2026-07-14T08:00:00Z");
    expect(task!.updatedAt).not.toBe(task!.createdAt);
  });

  it("skips sessions already linked and sessions with nothing to title", async () => {
    const linked = await store.createTask({ title: "existing" }, "operator");
    await store.upsertSession(seededRecord({ id: "s2", taskId: linked.id }));
    expect(await ensureTaskForSession(store, "s2", "operator")).toBeUndefined();
    await store.upsertSession(seededRecord({ id: "s3", title: undefined, firstPrompt: undefined }));
    expect(await ensureTaskForSession(store, "s3", "operator")).toBeUndefined();
  });

  it("heals a dangling link: taskId pointing at no stored task recreates the task", async () => {
    await store.upsertSession(seededRecord({ id: "s4", taskId: "gone", title: "Patch the session parser" }));
    const task = await ensureTaskForSession(store, "s4", "operator");
    expect(task?.title).toBe("Patch the session parser");
    expect(store.getSession("s4")?.taskId).toBe(task!.id);
  });
});

describe("connect flow (scan + import)", () => {
  it("scan reports Claude Code with windowed project and session counts", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "hi" });
    writeSession("D--repos-other", "bbb", { cwd: "D:/repos/other", firstPrompt: "yo" });
    // outside the 30-day backfill window: counted by neither scan nor import
    writeSession("D--repos-stale", "ccc", { cwd: "D:/repos/stale", firstPrompt: "old", mtime: new Date(Date.now() - 40 * 24 * 60 * 60_000) });
    const source = new LiveSessionSource(storeRoot);
    const apps = await scanApps(store, source);
    expect(apps).toEqual([
      expect.objectContaining({ id: "claude-code", found: true, connected: false, importable: true, projectCount: 2, sessionCount: 2 }),
      /* the scan-only row (dogfood r2): found is machine-dependent, importable never */
      expect.objectContaining({ id: "codex", connected: false, importable: false })
    ]);
  });

  it("codex scan counts nested jsonl and reports absence as not found", async () => {
    const root = path.join(storeRoot, "codex-sessions");
    mkdirSync(path.join(root, "2026", "07", "14"), { recursive: true });
    writeFileSync(path.join(root, "legacy.jsonl"), "{}\n");
    writeFileSync(path.join(root, "2026", "07", "14", "rollout-1.jsonl"), "{}\n");
    writeFileSync(path.join(root, "2026", "07", "14", "rollout-2.jsonl"), "{}\n");
    writeFileSync(path.join(root, "2026", "07", "14", "notes.txt"), "not a session\n");
    expect(await scanCodex(root)).toEqual(
      expect.objectContaining({ id: "codex", found: true, importable: false, sessionCount: 3 })
    );
    expect(await scanCodex(path.join(storeRoot, "nope"))).toEqual(
      expect.objectContaining({ id: "codex", found: false, sessionCount: 0 })
    );
  });

  it("lists windowed candidates with labels; internal and stale sessions never appear", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser", title: "Fix the parser" });
    writeSession("D--repos-stale", "old1", { cwd: "D:/repos/stale", firstPrompt: "old", mtime: new Date(Date.now() - 40 * 24 * 60 * 60_000) });
    // a directory holding only Trail's own harvest runs is not a candidate
    writeSession("D--repos-harness", "hv1", {
      cwd: "D:/repos/harness",
      firstPrompt: "You are an evidence harvester for a task tracker. Read the digest…"
    });
    const source = new LiveSessionSource(storeRoot);
    const candidates = await listConnectCandidates(source);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ storeDir: "D--repos-new-folder", dir: "D:/repos/new-folder", name: "new-folder" });
    expect(candidates[0].sessions).toEqual([
      expect.objectContaining({ id: "aaa", label: "Fix the parser" })
    ]);
  });

  it("connect registers the app, imports projects with leaf names, and turns sessions into tasks", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser", title: "Fix the parser" });
    const source = new LiveSessionSource(storeRoot);
    const result = await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    expect(result).toEqual({ ok: true, projects: 1, sessionsQueued: 1 });
    expect(store.getSettings().connectedApps).toContain("claude-code");
    expect(store.getSettings().excludedStoreDirs).toEqual([]);

    const project = store.getProjectByStoreDir("D--repos-new-folder");
    expect(project?.name).toBe("new-folder");
    expect(project?.dir).toBe("D:/repos/new-folder");

    // session import runs in the background; wait for the session-task link to land
    await expect.poll(() => store.getSession("aaa")?.taskId, { timeout: 3000 }).toBeTruthy();
    const task = store.listTasks()[0];
    expect(store.listTasks()).toHaveLength(1);
    expect(task.title).toBe("Fix the parser");
    expect(task.status).toBe("ready"); // fixture mtime is long past idle
    expect(task.projectId).toBe(project?.id);
    expect(store.getSession("aaa")?.taskId).toBe(task.id);
  });

  it("keeps Trail's own harvest runs out of the import", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser" });
    writeSession("D--repos-new-folder", "bbb", {
      cwd: "D:/repos/new-folder",
      firstPrompt: "You are an evidence harvester for a task tracker. Read the session digest…"
    });
    expect(isTrailInternal({ firstPrompt: "You are an evidence harvester for a task tracker. x" })).toBe(true);
    expect(isTrailInternal({ firstPrompt: "fix the parser" })).toBe(false);
    const source = new LiveSessionSource(storeRoot);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await expect.poll(() => store.listTasks().length, { timeout: 3000 }).toBe(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(store.listTasks()).toHaveLength(1);
    expect(store.getSession("bbb")).toBeUndefined();
  });

  it("import births Ready when the closing turn claims and asks nothing (D24 rides the import path)", async () => {
    // recent mtime: the clock alone says waiting; the content says finished
    writeSession("D--repos-new-folder", "aaa", {
      cwd: "D:/repos/new-folder", firstPrompt: "summarize the research",
      mtime: new Date(Date.now() - 5 * 60_000)
    });
    const source = new LiveSessionSource(storeRoot);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await expect.poll(() => store.getSession("aaa")?.taskId, { timeout: 3000 }).toBeTruthy();
    await expect.poll(() => store.listTasks()[0]?.status, { timeout: 3000 }).toBe("ready");
  });

  it("import keeps a genuinely blocked session Waiting: the closing turn asks a question", async () => {
    writeSession("D--repos-new-folder", "aaa", {
      cwd: "D:/repos/new-folder", firstPrompt: "summarize the research",
      mtime: new Date(Date.now() - 5 * 60_000),
      lastText: "Done with the draft. Should I also update the README?"
    });
    const source = new LiveSessionSource(storeRoot);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await expect.poll(() => store.getSession("aaa")?.taskId, { timeout: 3000 }).toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(store.listTasks()[0]?.status).toBe("waiting");
  });

  it("a session with no assistant turns never reaches the picker or the import", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser" });
    // the queued-prompt stillborn: a restart re-dispatched the queue into a fresh session
    writeSession("D--repos-new-folder", "bbb", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser", stillborn: true });
    const source = new LiveSessionSource(storeRoot);
    const candidates = await listConnectCandidates(source);
    expect(candidates[0].sessions.map((s) => s.id)).toEqual(["aaa"]);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await expect.poll(() => store.listTasks().length, { timeout: 3000 }).toBe(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(store.listTasks()).toHaveLength(1);
    expect(store.getSession("bbb")).toBeUndefined();
  });

  it("re-running connect does not duplicate tasks or projects", async () => {
    writeSession("D--repos-new-folder", "aaa", { cwd: "D:/repos/new-folder", firstPrompt: "fix the parser" });
    const source = new LiveSessionSource(storeRoot);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await expect.poll(() => store.listTasks().length, { timeout: 3000 }).toBe(1);
    await connectClaudeCode(store, source, [{ storeDir: "D--repos-new-folder" }]);
    await new Promise((r) => setTimeout(r, 300));
    expect(store.listTasks()).toHaveLength(1);
    expect(store.listProjects()).toHaveLength(1);
  });
});

describe("project-scoped import (r1B)", () => {
  it("imports only selected projects and records the rest as excluded", async () => {
    writeSession("D--repos-keep", "aaa", { cwd: "D:/repos/keep", firstPrompt: "fix the parser" });
    writeSession("D--repos-noise", "bbb", { cwd: "D:/repos/noise", firstPrompt: "scratch run" });
    const source = new LiveSessionSource(storeRoot);
    const result = await connectClaudeCode(store, source, [{ storeDir: "D--repos-keep" }]);
    expect(result).toEqual({ ok: true, projects: 1, sessionsQueued: 1 });
    await expect.poll(() => store.getSession("aaa")?.taskId, { timeout: 3000 }).toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(store.getSession("bbb")).toBeUndefined();
    expect(store.getProject("D--repos-noise")).toBeUndefined();
    expect(store.listSessions()).toHaveLength(1);
    expect(store.getSettings().excludedStoreDirs).toEqual(["D--repos-noise"]);
  });

  it("honors session-level pruning inside a selected project", async () => {
    writeSession("D--repos-keep", "aaa", { cwd: "D:/repos/keep", firstPrompt: "fix the parser" });
    writeSession("D--repos-keep", "bbb", { cwd: "D:/repos/keep", firstPrompt: "poke around" });
    const source = new LiveSessionSource(storeRoot);
    const result = await connectClaudeCode(store, source, [{ storeDir: "D--repos-keep", sessionIds: ["aaa"] }]);
    expect(result).toEqual({ ok: true, projects: 1, sessionsQueued: 1 });
    await expect.poll(() => store.getSession("aaa")?.taskId, { timeout: 3000 }).toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(store.getSession("bbb")).toBeUndefined();
    expect(store.listSessions()).toHaveLength(1);
    expect(store.listTasks()).toHaveLength(1);
    // the pruned session's project stays selected, not excluded
    expect(store.getSettings().excludedStoreDirs).toEqual([]);
  });
});

describe("dir-bearing projects are never excluded (D27)", () => {
  it("saving a project with a known directory adopts its store dir and lifts the exclusion", async () => {
    writeSession("D--repos-mine", "s1", { cwd: "D:\repos\mine", firstPrompt: "work" });
    const source = new LiveSessionSource(storeRoot);
    await store.saveSettings({ connectedApps: ["claude-code"], excludedStoreDirs: ["D--repos-mine"] });
    const project = await store.createProject({ name: "mine", dir: "D:\repos\mine" });

    const { adoptStoreDirForProject } = await import("../server/connect");
    await adoptStoreDirForProject(store, source, project.id);

    expect(store.getProject(project.id)?.storeDir).toBe("D--repos-mine");
    expect(store.getSettings().excludedStoreDirs).toEqual([]);
    /* the watcher check the exclusion used to fail */
    expect(store.getProjectByStoreDir("D--repos-mine")?.id).toBe(project.id);
  });

  it("a directory with no Claude Code store is a no-op", async () => {
    const source = new LiveSessionSource(storeRoot);
    await store.saveSettings({ connectedApps: ["claude-code"], excludedStoreDirs: ["D--elsewhere"] });
    const project = await store.createProject({ name: "plain", dir: "D:\repos\no-store-here" });

    const { adoptStoreDirForProject } = await import("../server/connect");
    await adoptStoreDirForProject(store, source, project.id);

    expect(store.getProject(project.id)?.storeDir).toBeUndefined();
    expect(store.getSettings().excludedStoreDirs).toEqual(["D--elsewhere"]);
  });
});
