import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressByDay, runRecon } from "../server/reconcile";
import { Store } from "../server/store/db";

let dataDir: string;
let store: Store;
const DAY = "2026-07-15";

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-recon-"));
  store = new Store(dataDir);
  await store.load();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

async function linkEvidence(taskId: string, sessionId: string, withCommit: boolean, withClaim: boolean) {
  await store.upsertSession({
    id: sessionId, projectDir: "D:/x", storeDir: "d", file: `${sessionId}.jsonl`,
    startedAt: `${DAY}T08:00:00`, lastActiveAt: `${DAY}T09:00:00`,
    liveStatus: "closed", suggestions: [], harvestState: "heuristic", imported: true
  });
  await store.linkSession(taskId, sessionId, "automation");
  const gen = "g1";
  const events = [];
  if (withCommit) events.push({ sessionId, taskId, kind: "commit-ref" as const, payload: { sha: "abc1234" }, source: { file: "f", line: 1 }, gen, at: `${DAY}T09:00:00` });
  if (withClaim) events.push({ sessionId, taskId, kind: "outcome-claim" as const, payload: { text: "done" }, source: { file: "f", line: 2 }, gen, at: `${DAY}T09:00:00` });
  if (events.length) await store.appendEvidence(events);
}

describe("reconciliation (R6/D12)", () => {
  it("resolves confirmed / claimed-unverified / open; open rolls over unredated (R7 deferred)", async () => {
    const confirmed = await store.createTask({ title: "confirmed", date: DAY }, "operator");
    await store.moveStatus(confirmed.id, "done", "operator");
    await linkEvidence(confirmed.id, "s-conf", true, true);

    const claimed = await store.createTask({ title: "claimed", date: DAY }, "operator");
    await linkEvidence(claimed.id, "s-claim", false, true);

    const open = await store.createTask({ title: "open", date: DAY }, "operator");

    const shelved = await store.createTask({ title: "shelved", date: DAY }, "operator");
    await store.moveStatus(shelved.id, "shelved", "operator");

    const run = await runRecon(store, DAY);
    const verdictOf = (id: string) => run.results.find((r) => r.taskId === id)?.verdict;
    expect(verdictOf(confirmed.id)).toBe("confirmed");
    expect(verdictOf(claimed.id)).toBe("claimed-unverified");
    expect(verdictOf(open.id)).toBe("open");
    expect(run.results.some((r) => r.taskId === shelved.id)).toBe(false);
    expect(run.rollovers).toEqual([open.id]);
    // stored, never auto-redated
    expect(store.getTask(open.id)?.date).toBe(DAY);
    expect(store.listRecons().some((r) => r.day === DAY)).toBe(true);
  });

  it("records unlinked sessions of the day as drift (stored, not rendered)", async () => {
    await store.upsertSession({
      id: "s-drift", projectDir: "D:/x", storeDir: "d", file: "s-drift.jsonl",
      startedAt: `${DAY}T10:00:00`, lastActiveAt: `${DAY}T11:00:00`,
      liveStatus: "closed", title: "Unplanned rabbit hole", suggestions: [], harvestState: "heuristic", imported: true
    });
    const run = await runRecon(store, DAY);
    expect(run.drift).toEqual([{ sessionId: "s-drift", title: "Unplanned rabbit hole" }]);
  });

});

/* fake Date only: the store's fs writes must keep running on real I/O */
const onDay = (day: string, time = "12:00:00") => vi.setSystemTime(new Date(`${day}T${time}`));

describe("progress projection (dogfood r1B): ready + done per day", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("same-day ready→done counts once, as Done", async () => {
    onDay(DAY, "09:00:00");
    const t = await store.createTask({ title: "ratified same day", date: DAY }, "operator");
    await store.moveStatus(t.id, "running", "automation");
    await store.moveStatus(t.id, "ready", "automation");
    onDay(DAY, "17:00:00");
    await store.moveStatus(t.id, "done", "operator");
    const byDay = progressByDay(store);
    expect(byDay[DAY]).toEqual({ done: [t.id], ready: [] });
  });

  it("a dated task counts on its own day even when ratified later (dogfood r3)", async () => {
    onDay(DAY, "12:00:00");
    const t = await store.createTask({ title: "imported", status: "ready", date: "2026-07-02" }, "automation");
    const byDay = progressByDay(store);
    expect(byDay["2026-07-02"]).toEqual({ done: [], ready: [t.id] });
    expect(byDay[DAY]).toBeUndefined();
    /* a later batch sign-off flips the group, never the day */
    await store.moveStatus(t.id, "done", "operator");
    const after = progressByDay(store);
    expect(after["2026-07-02"]).toEqual({ done: [t.id], ready: [] });
    expect(after[DAY]).toBeUndefined();
  });

  it("an undated task counts on the day its current status landed", async () => {
    onDay("2026-07-13");
    const t = await store.createTask({ title: "spread" }, "operator");
    await store.moveStatus(t.id, "ready", "automation");
    expect(progressByDay(store)["2026-07-13"]).toEqual({ done: [], ready: [t.id] });
    onDay("2026-07-14");
    await store.moveStatus(t.id, "done", "operator");
    const byDay = progressByDay(store);
    expect(byDay["2026-07-13"]).toBeUndefined();
    expect(byDay["2026-07-14"]).toEqual({ done: [t.id], ready: [] });
  });

  it("leaving Ready anywhere but Done withdraws the signal; re-entry recounts on the new day", async () => {
    onDay("2026-07-10");
    const t = await store.createTask({ title: "sent back" }, "operator");
    await store.moveStatus(t.id, "ready", "automation");
    onDay("2026-07-11");
    await store.moveStatus(t.id, "running", "automation"); // claim rejected
    expect(progressByDay(store)["2026-07-10"]).toBeUndefined();
    onDay("2026-07-12");
    await store.moveStatus(t.id, "ready", "automation");
    const byDay = progressByDay(store);
    expect(byDay["2026-07-10"]).toBeUndefined();
    expect(byDay["2026-07-12"]).toEqual({ done: [], ready: [t.id] });
  });

  it("reopening a ratified task withdraws both counts", async () => {
    onDay("2026-07-13");
    const t = await store.createTask({ title: "reopened" }, "operator");
    await store.moveStatus(t.id, "ready", "automation");
    onDay("2026-07-14");
    await store.moveStatus(t.id, "done", "operator");
    onDay("2026-07-15");
    await store.moveStatus(t.id, "planned", "operator");
    const byDay = progressByDay(store);
    expect(byDay["2026-07-13"]).toBeUndefined();
    expect(byDay["2026-07-14"]).toBeUndefined();
  });

  it("done keeps its rule: latest Done move wins, reopens uncount", async () => {
    onDay(DAY);
    const a = await store.createTask({ title: "a", date: DAY }, "operator");
    const b = await store.createTask({ title: "b", date: DAY }, "operator");
    await store.moveStatus(a.id, "done", "operator");
    await store.moveStatus(b.id, "done", "operator");
    await store.moveStatus(b.id, "planned", "operator");
    expect(progressByDay(store)[DAY]).toEqual({ done: [a.id], ready: [] });
  });
});
