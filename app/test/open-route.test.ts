import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* no real program launches from a test run: the route's dynamic import
   of child_process lands on this mock */
const spawned: string[][] = [];
vi.mock("node:child_process", () => ({
  spawn: (cmd: string, args: string[]) => {
    spawned.push([cmd, ...args]);
    return { on: () => undefined, unref: () => undefined };
  }
}));
import type { SessionSource } from "../server/adapters/sessions/types";
import type { Dispatcher } from "../server/dispatch";
import { registerRoutes } from "../server/routes";
import { Store } from "../server/store/db";

/* /api/open spawns local programs on a caller-supplied path, so it
   carries the preview route's evidence gate (D31 review): only paths the
   evidence log references may open; anything else is 403 — the client
   never sends such a path, so a failing request is not Trail talking. */

let dir: string;
let store: Store;
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "trail-open-"));
  store = new Store(dir);
  await store.load();
  app = Fastify();
  registerRoutes(app, store, {} as SessionSource, {} as Dispatcher);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("/api/open evidence gate", () => {
  it("rejects a path the evidence log does not reference", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/open",
      payload: { kind: "file", path: path.join(dir, "not-evidence.txt") }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "not an evidence file" });
    expect(spawned).toEqual([]);
  });

  it("accepts a path the evidence log references", async () => {
    const p = path.join(dir, "wave2-themes.md");
    writeFileSync(p, "themes");
    await store.appendEvidence([
      { sessionId: "s1", at: "2026-07-20T10:00:00Z", kind: "file-ref", payload: { path: p }, source: { file: "s1.jsonl", line: 1 }, gen: "g1" }
    ]);
    /* destination for .md is the editor */
    const res = await app.inject({
      method: "POST",
      url: "/api/open",
      payload: { kind: "file", path: p }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(spawned).toEqual([["cmd", "/c", "code", p]]);
  });
});
