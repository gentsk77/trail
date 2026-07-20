import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WtDispatcher, buildPack } from "../server/dispatch";
import { Store } from "../server/store/db";

let dataDir: string;
let store: Store;

beforeEach(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "trail-dispatch-"));
  store = new Store(dataDir);
  await store.load();
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("dispatch (R8)", () => {
  it("writes the pack with marker + objective chain and spawns wt in the workdir", async () => {
    const l1 = await store.createObjective({ title: "Own the toolchain", level: 1 });
    const l2 = await store.createObjective({ title: "Make Trail self-hosting", level: 2, parentId: l1.id });
    const project = await store.createProject({ name: "alpha", dir: "D:\\Repo\\alpha" });
    const task = await store.createTask(
      { title: "Wire the adapter", description: "Read-only JSONL adapter.", objectiveId: l2.id, projectId: project.id },
      "operator"
    );
    const calls: { cmd: string; args: string[] }[] = [];
    const dispatcher = new WtDispatcher(store, path.join(dataDir, "packs"), (cmd, args) => calls.push({ cmd, args }));

    const result = await dispatcher.dispatch(task.id);
    expect(result.launched).toBe(true);
    expect(result.pack).toContain(`[trail-task:${task.id}]`);
    expect(result.pack).toContain("- Own the toolchain");
    expect(result.pack).toContain("  - Make Trail self-hosting");

    const packPath = path.join(dataDir, "packs", `${task.id}.md`);
    expect(existsSync(packPath)).toBe(true);
    expect(readFileSync(packPath, "utf8")).toBe(result.pack);

    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe("wt");
    expect(calls[0].args.slice(0, 3)).toEqual(["-d", "D:\\Repo\\alpha", "claude"]);
    /* the pack itself rides as the first prompt — no file indirection */
    expect(calls[0].args[3]).toContain(`[trail-task:${task.id}]`);
    expect(calls[0].args[3]).toContain("# Task brief: Wire the adapter");
    expect(calls[0].args[3]).toContain("Read-only JSONL adapter.");
    expect(calls[0].args[3]).not.toContain(packPath);

    expect(store.getTask(task.id)?.dispatch?.packPath).toBe(packPath);
    expect(store.listActivity(task.id).some((a) => a.kind === "dispatched")).toBe(true);
  });

  it("escapes wt's pane separator in the prompt", async () => {
    const project = await store.createProject({ name: "alpha", dir: "D:\\Repo\\alpha" });
    const task = await store.createTask({ title: "Do x; then y", projectId: project.id }, "operator");
    const calls: { cmd: string; args: string[] }[] = [];
    const dispatcher = new WtDispatcher(store, path.join(dataDir, "packs"), (cmd, args) => calls.push({ cmd, args }));
    await dispatcher.dispatch(task.id);
    expect(calls[0].args[3]).toContain("Do x\\; then y");
  });

  it("refuses without a working directory, stating the next step", async () => {
    const task = await store.createTask({ title: "No dir" }, "operator");
    const dispatcher = new WtDispatcher(store, path.join(dataDir, "packs"), () => {});
    await expect(dispatcher.dispatch(task.id)).rejects.toThrow(/Set a project with a directory/);
  });

  it("refuses when the task's project is folderless", async () => {
    const project = await store.createProject({ name: "Personal errands" });
    const task = await store.createTask({ title: "No dir", projectId: project.id }, "operator");
    const dispatcher = new WtDispatcher(store, path.join(dataDir, "packs"), () => {});
    await expect(dispatcher.dispatch(task.id)).rejects.toThrow(/Set a project with a directory/);
  });

  it("pack states the plain-finish convention", () => {
    const pack = buildPack(
      { id: "x", title: "T", status: "planned", createdAt: "", updatedAt: "", linkedSessionIds: [] },
      [],
      "D:\\w"
    );
    expect(pack).toContain("state plainly what was produced");
  });
});
