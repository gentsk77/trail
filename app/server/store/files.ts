import { promises as fs } from "node:fs";
import path from "node:path";

/* Atomic JSON document + append-only JSONL primitives. Atomicity via
   tmp-write + rename so a crash never leaves a torn document. */

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/* Writes to one document serialize in-process (watcher, sweep, and HTTP
   handlers all write concurrently), and the rename retries briefly —
   Windows throws EPERM/EBUSY while a scanner or reader holds the file. */
const writeChains = new Map<string, Promise<void>>();

export function writeJson(file: string, value: unknown): Promise<void> {
  const prev = writeChains.get(file) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => writeJsonNow(file, value));
  writeChains.set(file, next);
  return next;
}

async function writeJsonNow(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  for (let attempt = 1; ; attempt += 1) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw err;
      await new Promise((r) => setTimeout(r, 50 * attempt));
    }
  }
}

export async function appendJsonl(file: string, records: unknown[]): Promise<void> {
  if (records.length === 0) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await fs.appendFile(file, lines, "utf8");
}

export async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const text = await fs.readFile(file, "utf8");
    const out: T[] = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        out.push(JSON.parse(t) as T);
      } catch {
        /* tolerate torn tail lines */
      }
    }
    return out;
  } catch {
    return [];
  }
}
