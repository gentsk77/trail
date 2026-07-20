import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { ActivityEvent, Project, Task } from "../src/lib/types";
import { readJson, readJsonl, writeJson } from "../server/store/files";

/* One-time, gated migration (coding-handoff §4, D18): projects become
   first-class. Old projects.json entries ({storeDir,dir,name,source,
   connectedAt}, no id) gain ids; each task's projectDir becomes a
   projectId (find-or-create by directory); statusAt backfills from the
   activity log's latest status move, else createdAt.

     npm run migrate:projects -- <dataDir>          plan only
     npm run migrate:projects -- <dataDir> write    migrate

   Same grammar as migrate:backdate-imports: plan-only default, the bare
   gate word `write` (npm's Windows shim strips --flags after --), data
   dir from argument / TRAIL_DATA / app/data. tasks.json and projects.json
   are backed up beside themselves before any write. Idempotent: a second
   run finds nothing old-shaped and plans nothing. */

interface OldProject {
  id?: string;
  storeDir?: string;
  dir?: string;
  name?: string;
  source?: "claude-code";
  connectedAt?: string;
  createdAt?: string;
}

type OldTask = Task & { projectDir?: string };

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--");
const write = args.includes("write") || args.includes("--write");
const dirArg = args.find((a) => a !== "write" && !a.startsWith("--"));
const dataDir = dirArg ?? process.env.TRAIL_DATA ?? path.join(here, "..", "data");

const tasksFile = path.join(dataDir, "tasks.json");
const projectsFile = path.join(dataDir, "projects.json");
const activityFile = path.join(dataDir, "activity.jsonl");

try {
  await fs.access(tasksFile);
} catch {
  console.error(`no tasks.json under ${dataDir} — pass the data dir or set TRAIL_DATA`);
  process.exit(1);
}

const tasks = await readJson<OldTask[]>(tasksFile, []);
const oldProjects = await readJson<OldProject[]>(projectsFile, []);
const activity = await readJsonl<ActivityEvent>(activityFile);

const dirKey = (dir: string) => path.resolve(dir).toLowerCase();

/* pass 1: projects gain ids; already-new entries pass through untouched */
let projectsConverted = 0;
const projects: Project[] = oldProjects.map((p) => {
  if (p.id) return p as Project;
  projectsConverted += 1;
  return {
    id: randomUUID(),
    name: p.name ?? (p.dir ? p.dir.split(/[\\/]/).filter(Boolean).pop()! : p.storeDir ?? "unnamed"),
    dir: p.dir,
    storeDir: p.storeDir,
    source: p.source,
    createdAt: p.connectedAt ?? p.createdAt ?? new Date().toISOString()
  };
});
const byDir = new Map(projects.filter((p) => p.dir).map((p) => [dirKey(p.dir!), p]));

/* pass 2: task projectDir -> projectId (find-or-create by directory);
   statusAt backfill from the latest status move in the activity log */
const lastStatusAt = new Map<string, string>();
for (const a of activity) {
  if (a.kind === "status") lastStatusAt.set(a.taskId, a.at);
}

let tasksLinked = 0;
let projectsCreated = 0;
let statusStamped = 0;
for (const task of tasks) {
  if (task.projectDir) {
    let project = byDir.get(dirKey(task.projectDir));
    if (!project) {
      project = {
        id: randomUUID(),
        name: task.projectDir.split(/[\\/]/).filter(Boolean).pop() ?? task.projectDir,
        dir: task.projectDir,
        createdAt: new Date().toISOString()
      };
      projects.push(project);
      byDir.set(dirKey(task.projectDir), project);
      projectsCreated += 1;
    }
    task.projectId = project.id;
    delete task.projectDir;
    tasksLinked += 1;
  }
  if (!task.statusAt) {
    task.statusAt = lastStatusAt.get(task.id) ?? task.createdAt;
    statusStamped += 1;
  }
}

console.log(`${dataDir}: ${tasks.length} tasks, ${oldProjects.length} project entries`);
console.log(`  projects: ${projectsConverted} converted, ${projectsCreated} created from task dirs`);
console.log(`  tasks: ${tasksLinked} linked to projects, ${statusStamped} statusAt backfilled`);

if (projectsConverted + projectsCreated + tasksLinked + statusStamped === 0) {
  console.log("nothing to migrate (already on the D18 shape)");
  process.exit(0);
}

if (!write) {
  console.log(`plan only: append the word "write" to migrate`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const file of [tasksFile, projectsFile]) {
  try {
    await fs.copyFile(file, file.replace(/\.json$/, `.backup-${stamp}.json`));
  } catch {
    /* projects.json may not exist yet */
  }
}
await writeJson(tasksFile, tasks);
await writeJson(projectsFile, projects);
console.log(`migrated; backups at *.backup-${stamp}.json`);
