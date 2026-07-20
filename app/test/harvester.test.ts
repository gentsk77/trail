import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LiveSessionSource } from "../server/adapters/sessions/live";
import { harvestSession } from "../server/harvester";
import { suggestLinks } from "../server/harvester/heuristic";
import { Store } from "../server/store/db";
import { fixtureSession } from "./fixtures";

const harvestHeuristic = (store: Store, parsed: Awaited<ReturnType<LiveSessionSource["readSession"]>>, imported: boolean) =>
  harvestSession(store, parsed, { imported });

let root: string;
let dataDir: string;
let store: Store;
let source: LiveSessionSource;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), "trail-harvest-root-"));
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-harvest-data-"));
  store = new Store(dataDir);
  await store.load();
  source = new LiveSessionSource(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

async function writeAndParse(name: string, content: string) {
  const dir = path.join(root, "D--Repo-alpha");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.jsonl`);
  writeFileSync(file, content);
  return source.readSession(file);
}

describe("heuristic harvester", () => {
  it("emits evidence with source pointers and a claim", async () => {
    const parsed = await writeAndParse("aaaa1111-0000-0000-0000-000000000001", fixtureSession({
      sessionId: "aaaa1111-0000-0000-0000-000000000001",
      cwd: "D:\\Repo\\alpha",
      firstPrompt: "fix the flaky ci test",
      title: "Flaky CI fix",
      editPath: "D:\\Repo\\alpha\\src\\ci.ts",
      commit: { sha: "abc1234", subject: "fix: stabilize ci" },
      pr: { url: "https://github.com/x/y/pull/9", number: 9 }
    }));
    await harvestHeuristic(store, parsed, true);
    const kinds = store.listEvidence({ sessionId: parsed.id }).map((e) => e.kind).sort();
    expect(kinds).toEqual([
      "commit-ref", "file-ref", "first-prompt", "outcome-claim", "pr-ref", "segment", "title"
    ]);
    const commit = store.listEvidence({ sessionId: parsed.id }).find((e) => e.kind === "commit-ref")!;
    expect(commit.source.line).toBeGreaterThan(1);
    expect(commit.payload.sha).toBe("abc1234");
    /* the waiting card's body (D17): the agent's last message persists */
    expect(store.getSession(parsed.id)?.lastAgentMessage).toBe("Done. Shipped the change and committed it.");
  });

  it("links dispatched sessions deterministically by marker (D5)", async () => {
    const task = await store.createTask({ title: "Ship the adapter" }, "operator");
    const parsed = await writeAndParse("aaaa1111-0000-0000-0000-000000000002", fixtureSession({
      sessionId: "aaaa1111-0000-0000-0000-000000000002",
      cwd: "D:\\Repo\\alpha",
      firstPrompt: `Work the brief. [trail-task:${task.id}]`
    }));
    const record = await harvestHeuristic(store, parsed, false);
    expect(record.taskId).toBe(task.id);
    expect(record.suggestions).toEqual([]);
    expect(store.getTask(task.id)?.linkedSessionIds).toContain(parsed.id);
    const evidence = store.listEvidence({ sessionId: parsed.id });
    expect(evidence.every((e) => e.taskId === task.id)).toBe(true);
  });

  it("re-harvest is idempotent for readers (latest gen wins)", async () => {
    const parsed = await writeAndParse("aaaa1111-0000-0000-0000-000000000003", fixtureSession({
      sessionId: "aaaa1111-0000-0000-0000-000000000003",
      cwd: "D:\\Repo\\alpha",
      firstPrompt: "explore the repo"
    }));
    await harvestHeuristic(store, parsed, true);
    const first = store.listEvidence({ sessionId: parsed.id }).length;
    await new Promise((r) => setTimeout(r, 5));
    await harvestHeuristic(store, parsed, true);
    expect(store.listEvidence({ sessionId: parsed.id })).toHaveLength(first);
  });

  it("suggests links for non-dispatched sessions, pending only", async () => {
    const project = await store.createProject({ name: "alpha", dir: "D:\\Repo\\alpha" });
    const task = await store.createTask({ title: "Stabilize the flaky ci pipeline", projectId: project.id }, "operator");
    const parsed = await writeAndParse("aaaa1111-0000-0000-0000-000000000004", fixtureSession({
      sessionId: "aaaa1111-0000-0000-0000-000000000004",
      cwd: "D:\\Repo\\alpha",
      firstPrompt: "the flaky ci pipeline keeps failing, stabilize it"
    }));
    const suggestions = suggestLinks(parsed, [task], () => project.dir);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].state).toBe("pending");
    expect(suggestions[0].confidence).toBeGreaterThan(0.4);
    const record = await harvestHeuristic(store, parsed, false);
    expect(record.taskId).toBeUndefined();
  });
});
