import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LiveSessionSource } from "../server/adapters/sessions/live";
import { HarvestQueue, harvestSession } from "../server/harvester";
import { buildDigest } from "../server/harvester/llm";
import { Store } from "../server/store/db";
import { fixtureSession } from "./fixtures";

let root: string;
let dataDir: string;
let store: Store;
let source: LiveSessionSource;

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), "trail-llm-root-"));
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-llm-data-"));
  store = new Store(dataDir);
  await store.load();
  source = new LiveSessionSource(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

async function parseFixture(name: string, prompt: string) {
  const dir = path.join(root, "D--Repo-alpha");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.jsonl`);
  writeFileSync(file, fixtureSession({ sessionId: name, cwd: "D:\\Repo\\alpha", firstPrompt: prompt }));
  return source.readSession(file);
}

describe("llm harvest pass", () => {
  it("merges claims/friction/lessons and link suggestions in one generation", async () => {
    const task = await store.createTask({ title: "Stabilize ci" }, "operator");
    const parsed = await parseFixture("bbbb1111-0000-0000-0000-000000000001", "make ci stable");
    const record = await harvestSession(store, parsed, {
      imported: true,
      llm: async () => ({
        claims: [{ text: "CI stabilized and merged" }],
        friction: ["retried flaky test twice"],
        lessons: ["pin the runner image version"],
        links: [{ taskId: task.id, confidence: 0.85, reason: "same goal" }]
      })
    });
    expect(record.harvestState).toBe("full");
    const kinds = store.listEvidence({ sessionId: parsed.id }).map((e) => e.kind);
    expect(kinds).toContain("friction");
    expect(kinds).toContain("lesson");
    expect(kinds.filter((k) => k === "outcome-claim").length).toBeGreaterThan(0);
    expect(record.suggestions[0]).toMatchObject({ taskId: task.id, confidence: 0.85, state: "pending" });
    expect(record.taskId).toBeUndefined(); // suggestion, never auto-link (R5)
  });

  it("degrades to heuristic-only when the extractor throws", async () => {
    const parsed = await parseFixture("bbbb1111-0000-0000-0000-000000000002", "explore something");
    const record = await harvestSession(store, parsed, {
      imported: true,
      llm: async () => {
        throw new Error("cli unavailable");
      }
    });
    expect(record.harvestState).toBe("heuristic-only");
    expect(store.listEvidence({ sessionId: parsed.id }).length).toBeGreaterThan(0);
  });

  it("queue serializes passes", async () => {
    const order: string[] = [];
    const queue = new HarvestQueue(store, async (parsed) => {
      order.push(`start:${parsed.id.slice(-1)}`);
      await new Promise((r) => setTimeout(r, 20));
      order.push(`end:${parsed.id.slice(-1)}`);
      return { claims: [], friction: [], lessons: [], links: [] };
    });
    const a = await parseFixture("bbbb1111-0000-0000-0000-000000000003", "a");
    const b = await parseFixture("bbbb1111-0000-0000-0000-000000000004", "b");
    await Promise.all([queue.push(a, true), queue.push(b, true)]);
    expect(order).toEqual(["start:3", "end:3", "start:4", "end:4"]);
  });

  it("digest carries the linking candidates", async () => {
    const project = await store.createProject({ name: "alpha", dir: "D:\\Repo\\alpha" });
    const task = await store.createTask({ title: "Ship adapter", projectId: project.id }, "operator");
    const parsed = await parseFixture("bbbb1111-0000-0000-0000-000000000005", "ship it");
    const digest = buildDigest(parsed, [task], () => project.dir);
    expect(digest).toContain(`id=${task.id}`);
    expect(digest).toContain("D:\\Repo\\alpha");
  });
});
