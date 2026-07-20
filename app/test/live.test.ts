import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyLiveStatus, shouldAutoTrack } from "../server/live";
import { Store } from "../server/store/db";
import type { SessionRecord } from "../src/lib/types";

let dataDir: string;
let store: Store;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-live-"));
  store = new Store(dataDir);
  await store.load();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

async function seedSession(taskId: string, liveStatus: SessionRecord["liveStatus"]): Promise<SessionRecord> {
  const record: SessionRecord = {
    id: "s1", projectDir: "D:/x", storeDir: "d", file: "s1.jsonl",
    startedAt: "2026-07-15T08:00:00Z", lastActiveAt: "2026-07-15T09:00:00Z",
    liveStatus, taskId, suggestions: [], harvestState: "heuristic", imported: false
  };
  await store.upsertSession(record);
  return record;
}

describe("live status propagation (R8/D8)", () => {
  it("running session moves the linked task to Running by automation", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "running");
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("running");
    const move = store.listActivity(task.id).find((a) => a.kind === "status");
    expect(move?.by).toBe("automation");
  });

  it("waiting session moves the task to Waiting", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "waiting");
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("waiting");
  });

  it("waiting session whose completed turn claims an outcome reaches Ready (dogfood r5)", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "waiting");
    await store.patchSession("s1", { lastAgentMessage: "All clean — merged the fix. Nothing pending." });
    await store.appendEvidence([
      { sessionId: "s1", taskId: task.id, kind: "outcome-claim", payload: { text: "merged" }, source: { file: "s1.jsonl", line: 9 }, gen: "g", at: "2026-07-15T09:00:00Z" }
    ]);
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("ready");
  });

  it("waiting session that ends on a question stays Waiting despite claim words", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "waiting");
    await store.patchSession("s1", { lastAgentMessage: "Merged the fix — **should I also update the docs?**" });
    await store.appendEvidence([
      { sessionId: "s1", taskId: task.id, kind: "outcome-claim", payload: { text: "merged" }, source: { file: "s1.jsonl", line: 9 }, gen: "g", at: "2026-07-15T09:00:00Z" }
    ]);
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("waiting");
  });

  it("a claim from an earlier turn never promotes the current wait", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "waiting");
    await store.patchSession("s1", { lastAgentMessage: "Working through the review notes." });
    await store.appendEvidence([
      { sessionId: "s1", taskId: task.id, kind: "outcome-claim", payload: { text: "merged" }, source: { file: "s1.jsonl", line: 5 }, gen: "g", at: "2026-07-15T08:30:00Z" }
    ]);
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("waiting");
  });

  it("closed session with an outcome claim reaches Ready — never Done", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "closed");
    await store.appendEvidence([
      { sessionId: "s1", taskId: task.id, kind: "outcome-claim", payload: { text: "done" }, source: { file: "s1.jsonl", line: 9 }, gen: "g", at: "2026-07-15T09:00:00Z" }
    ]);
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("ready");
  });

  it("closed session with no claim moves nothing (no claim, no verdict)", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await seedSession(task.id, "closed");
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("planned");
  });

  it("never touches Done or Shelved, and never demotes Ready", async () => {
    const task = await store.createTask({ title: "t" }, "operator");
    await store.moveStatus(task.id, "done", "operator");
    await seedSession(task.id, "running");
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task.id)?.status).toBe("done");

    const task2 = await store.createTask({ title: "t2" }, "operator");
    await store.moveStatus(task2.id, "ready", "automation");
    await store.patchSession("s1", { taskId: task2.id, liveStatus: "running" });
    await applyLiveStatus(store, "s1");
    expect(store.getTask(task2.id)?.status).toBe("ready");
  });
});

describe("watch gating (r1B project scoping)", () => {
  it("tracks known and dispatch-marked sessions; never Trail's own harvest runs", async () => {
    expect(shouldAutoTrack(store, { storeDir: "d" }, true)).toBe(true);
    expect(shouldAutoTrack(store, { storeDir: "d", markerTaskId: "t1" }, false)).toBe(true);
    expect(
      shouldAutoTrack(store, { storeDir: "d", firstPrompt: "You are an evidence harvester for a task tracker. x" }, false)
    ).toBe(false);
  });

  it("auto-tracks a new session only when connected and its project is not excluded", async () => {
    expect(shouldAutoTrack(store, { storeDir: "d" }, false)).toBe(false); // not connected
    await store.saveSettings({ connectedApps: ["claude-code"], excludedStoreDirs: ["noise"] });
    expect(shouldAutoTrack(store, { storeDir: "d" }, false)).toBe(true);
    expect(shouldAutoTrack(store, { storeDir: "noise" }, false)).toBe(false);
  });
});
