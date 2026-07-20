import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { LiveSessionSource } from "./adapters/sessions/live";
import { adoptStoreDirForProject } from "./connect";
import { WtDispatcher } from "./dispatch";
import { HarvestQueue } from "./harvester";
import { claudeExtractor } from "./harvester/llm";
import { startLiveWatch } from "./live";
import { startReconTimer } from "./reconcile";
import { Store } from "./store/db";
import { registerRoutes } from "./routes";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.TRAIL_DATA ?? path.join(here, "..", "data");

const app = Fastify({ logger: { level: "warn" } });
await app.register(cors, { origin: true });

const store = new Store(dataDir);
await store.load();

const source = new LiveSessionSource();
const llm = process.env.TRAIL_NO_LLM ? undefined : claudeExtractor;
const queue = new HarvestQueue(store, llm);
const dispatcher = new WtDispatcher(store, path.join(dataDir, "packs"));

registerRoutes(app, store, source, dispatcher);
startLiveWatch(store, source, queue);
startReconTimer(store);

/* the D27 invariant holds for stores written before the rule: a
   dir-bearing project is never excluded */
void (async () => {
  for (const project of store.listProjects()) {
    if (project.dir) await adoptStoreDirForProject(store, source, project.id);
  }
})();

/* TRAIL_PORT: run a second sidecar (throwaway TRAIL_DATA) beside a live one */
app.listen({ port: Number(process.env.TRAIL_PORT ?? 5175), host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
