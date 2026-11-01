import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionSource } from "../server/adapters/sessions/types";
import type { Dispatcher } from "../server/dispatch";
import { LOCAL_ORIGINS, registerRoutes } from "../server/routes";
import { Store } from "../server/store/db";

/* the SSE stream writes its own head, so it must carry the same origin
   policy as every other route instead of a wildcard */

let dir: string;
let app: ReturnType<typeof Fastify>;
let port: number;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "trail-events-"));
  const store = new Store(dir);
  await store.load();
  app = Fastify();
  await app.register(cors, { origin: LOCAL_ORIGINS });
  registerRoutes(app, store, {} as SessionSource, {} as Dispatcher);
  await app.listen({ port: 0, host: "127.0.0.1" });
  port = (app.server.address() as AddressInfo).port;
});

afterEach(async () => {
  app.server.closeAllConnections();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function eventsHeaders(origin: string) {
  return new Promise<Record<string, string | string[] | undefined>>((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path: "/api/events", headers: { origin } },
      (res) => {
        resolve(res.headers);
        res.destroy();
      }
    );
    req.on("error", reject);
    req.end();
  });
}

describe("/api/events origin policy", () => {
  it("does not grant a foreign origin", async () => {
    const headers = await eventsHeaders("https://evil.example");
    expect(headers["content-type"]).toBe("text/event-stream");
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers Trail's own localhost page", async () => {
    const headers = await eventsHeaders("http://localhost:5173");
    expect(headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
