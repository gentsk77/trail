import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Objective, Task } from "../../src/lib/types";
import type { Store } from "../store/db";

/* Dispatch (R8): a context pack (the task and its why) sent as the first
   prompt of an interactive claude session in a Windows Terminal window at
   the task's working directory. The pack also lands on disk for the
   record. The [trail-task:<id>] marker travels in the first prompt, so
   the evidence chain is deterministic (D5). */

export function buildPack(task: Task, chain: Objective[], projectDir: string): string {
  const why = chain.length
    ? chain.map((o, i) => `${"  ".repeat(i)}- ${o.title}${o.description ? ` — ${o.description}` : ""}`).join("\n")
    : "- (no linked objective)";
  return `# Task brief: ${task.title}

[trail-task:${task.id}]

## Task
${task.description ?? task.title}

## Why (objective chain, outermost first)
${why}

## Working directory
${projectDir}

## Conventions
- Work the task above in this directory.
- When you finish, state plainly what was produced (files, commits, PRs).
`;
}

export interface Dispatcher {
  dispatch(taskId: string): Promise<{ pack: string; launched: boolean }>;
}

export class WtDispatcher implements Dispatcher {
  constructor(
    private store: Store,
    private packsDir: string,
    private spawnImpl: (cmd: string, args: string[]) => void = defaultSpawn
  ) {}

  async dispatch(taskId: string): Promise<{ pack: string; launched: boolean }> {
    const task = this.store.getTask(taskId);
    if (!task) throw Object.assign(new Error(`no task ${taskId}`), { statusCode: 404 });
    const projectDir = task.projectId ? this.store.getProject(task.projectId)?.dir : undefined;
    if (!projectDir) {
      throw Object.assign(new Error("Set a project with a directory, then dispatch"), { statusCode: 400 });
    }
    const chain: Objective[] = [];
    let cur = this.store.listObjectives().find((o) => o.id === task.objectiveId);
    while (cur) {
      chain.unshift(cur);
      cur = this.store.listObjectives().find((o) => o.id === cur?.parentId);
    }
    const pack = buildPack(task, chain, projectDir);
    const packPath = path.join(this.packsDir, `${task.id}.md`);
    await fs.mkdir(this.packsDir, { recursive: true });
    await fs.writeFile(packPath, pack, "utf8");

    /* the pack itself is the first prompt — no file indirection for the
       CLI; wt treats ";" as a pane separator, so it travels escaped */
    const brief = pack.replace(/;/g, "\\;");
    this.spawnImpl("wt", ["-d", projectDir, "claude", brief]);

    await this.store.setDispatch(task.id, packPath);
    return { pack, launched: true };
  }
}

function defaultSpawn(cmd: string, args: string[]): void {
  spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false }).unref();
}
