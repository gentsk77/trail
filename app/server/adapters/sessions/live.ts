import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import chokidar from "chokidar";
import { parseSession, readTailAwaiting, summarizeSession } from "./parse";
import type { ProjectDirInfo, SessionSource, SessionSummary } from "./types";

/* Live source over the local Claude Code session store. Read-only by
   construction: readdir/stat/read streams only. */

export function defaultSessionRoot(): string {
  return process.env.TRAIL_SESSIONS_ROOT ?? path.join(os.homedir(), ".claude", "projects");
}

export class LiveSessionSource implements SessionSource {
  constructor(private storeRoot = defaultSessionRoot()) {}

  root(): string {
    return this.storeRoot;
  }

  async listProjects(): Promise<ProjectDirInfo[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(this.storeRoot);
    } catch {
      return [];
    }
    const out: ProjectDirInfo[] = [];
    for (const name of entries) {
      const dir = path.join(this.storeRoot, name);
      let files: string[] = [];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
      } catch {
        continue; // not a directory
      }
      if (files.length === 0) continue;
      let lastActive = 0;
      const sessionFiles: string[] = [];
      for (const f of files) {
        const abs = path.join(dir, f);
        try {
          const st = await stat(abs);
          lastActive = Math.max(lastActive, st.mtimeMs);
          sessionFiles.push(abs);
        } catch {
          /* raced delete */
        }
      }
      // real project path comes from a transcript's cwd (slug decode is lossy)
      let projectDir = "";
      for (const f of sessionFiles) {
        try {
          const s = await summarizeSession(f, name);
          if (s.projectDir) {
            projectDir = s.projectDir;
            break;
          }
        } catch {
          /* unreadable file; try the next */
        }
      }
      out.push({
        storeDir: name,
        projectDir,
        sessionFiles,
        lastActiveAt: new Date(lastActive).toISOString()
      });
    }
    return out.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  async listSessions(storeDir: string): Promise<SessionSummary[]> {
    const dir = path.join(this.storeRoot, storeDir);
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      return [];
    }
    const out: SessionSummary[] = [];
    for (const f of files) {
      try {
        out.push(await summarizeSession(path.join(dir, f), storeDir));
      } catch {
        /* skip unreadable */
      }
    }
    return out.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  readSession(file: string) {
    const storeDir = path.basename(path.dirname(file));
    return parseSession(file, storeDir);
  }

  readTailAwaiting(file: string) {
    return readTailAwaiting(file);
  }

  watch(cb: (file: string) => void): () => void {
    const watcher = chokidar.watch(this.storeRoot, {
      ignoreInitial: true,
      depth: 2,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 150 }
    });
    const onFile = (file: string) => {
      if (file.endsWith(".jsonl")) cb(file);
    };
    watcher.on("add", onFile);
    watcher.on("change", onFile);
    return () => void watcher.close();
  }
}
