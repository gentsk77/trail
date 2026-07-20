import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionRecord, Task } from "../src/lib/types";
import { applyBackdate, planBackdate } from "../server/harvester/backdate";
import { readJson, writeJson } from "../server/store/files";

/* One-time, gated migration (coding-handoff §4, dogfood r1B §1): rewrite
   import-burst createdAt from each task's linked-session startedAt.

     npm run migrate:backdate-imports -- <dataDir>          plan only
     npm run migrate:backdate-imports -- <dataDir> write    migrate

   Plan-only is the default; nothing mutates without the bare word
   `write` (npm's Windows shim strips every --flag after the -- separator
   before the script sees it — verified the hard way, so the gate word
   carries no dashes; --write also works when invoking tsx directly).
   Data dir resolution mirrors the server: argument, then TRAIL_DATA,
   then app/data. Never runs on server boot; only this script touches
   the files. tasks.json is backed up beside itself before any write.
   Idempotent: a second run finds the burst dissolved and plans nothing. */

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--");
const write = args.includes("write") || args.includes("--write");
const dirArg = args.find((a) => a !== "write" && !a.startsWith("--"));
const dataDir = dirArg ?? process.env.TRAIL_DATA ?? path.join(here, "..", "data");

const tasksFile = path.join(dataDir, "tasks.json");
const sessionsFile = path.join(dataDir, "sessions.json");

try {
  await fs.access(tasksFile);
} catch {
  console.error(`no tasks.json under ${dataDir} — pass the data dir or set TRAIL_DATA`);
  process.exit(1);
}

const tasks = await readJson<Task[]>(tasksFile, []);
const sessions = await readJson<SessionRecord[]>(sessionsFile, []);
const plans = planBackdate(tasks, sessions);

console.log(`${dataDir}: ${tasks.length} tasks, ${sessions.length} sessions`);
if (plans.length === 0) {
  console.log("nothing to backdate (no import burst, or already migrated)");
  process.exit(0);
}
for (const p of plans.slice(0, 10)) console.log(`  ${p.taskId}: ${p.from} -> ${p.to}`);
if (plans.length > 10) console.log(`  ... and ${plans.length - 10} more`);

if (!write) {
  console.log(`plan only: ${plans.length} task(s) would be backdated; append the word "write" to migrate`);
  process.exit(0);
}

const backup = path.join(dataDir, `tasks.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await fs.copyFile(tasksFile, backup);
await writeJson(tasksFile, applyBackdate(tasks, plans));
console.log(`backdated ${plans.length} task(s); backup at ${backup}`);
