import type { FastifyInstance } from "fastify";
import { commitUrl, destinationFor } from "../src/lib/destinations";
import { composeInbox } from "../src/lib/inbox";
import type { Actor, AgentAppId, Artifact, ConnectSelection, Status } from "../src/lib/types";
import type { SessionSource } from "./adapters/sessions/types";
import { adoptStoreDirForProject, connectClaudeCode, listConnectCandidates, scanApps } from "./connect";
import type { Dispatcher } from "./dispatch";
import { localDay, progressByDay, runRecon } from "./reconcile";
import type { Store } from "./store/db";

/* REST + SSE surface. The client's HttpClient mirrors these routes; the
   demo client implements the same interface over the bundled seed (D2). */

export function registerRoutes(app: FastifyInstance, store: Store, source: SessionSource, dispatcher: Dispatcher) {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/bootstrap", async () => ({
    tasks: store.listTasks(),
    objectives: store.listObjectives(),
    sessions: store.listSessions(),
    projects: store.listProjects(),
    recons: store.listRecons(),
    settings: store.getSettings()
  }));

  /* ---- tasks ---- */

  app.post<{ Body: { title: string; description?: string; objectiveId?: string; projectId?: string; date?: string; status?: Status } }>(
    "/api/tasks",
    async (req) => store.createTask(req.body, "operator")
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/tasks/:id",
    async (req) => store.updateTask(req.params.id, req.body)
  );

  app.post<{ Params: { id: string }; Body: { to: Status; by?: Actor } }>(
    "/api/tasks/:id/status",
    async (req) => store.moveStatus(req.params.id, req.body.to, req.body.by ?? "operator")
  );

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (req) => {
    await store.deleteTask(req.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/tasks/:id/detail", async (req) => {
    const task = store.getTask(req.params.id);
    const evidence = task
      ? store.listEvidence().filter((e) => e.taskId === task.id || task.linkedSessionIds.includes(e.sessionId))
      : [];
    return {
      task,
      activity: store.listActivity(req.params.id),
      artifacts: store.artifactsForTask(req.params.id),
      evidence
    };
  });

  /* open a local artifact where the destination map says it opens (D17):
     sessions resume in a terminal (r1B.2), html/links in the browser,
     images in the OS viewer, everything else in the editor. The map is
     the one home for the rule — nothing here decides per-surface. */
  app.post<{ Body: { path?: string; sessionId?: string; kind?: string; sha?: string } }>("/api/open", async (req, reply) => {
    /* the preview route's evidence gate, applied to spawns (D31 review):
       a path only opens if the evidence log references it — the client
       never sends anything else (href artifacts open client-side), so
       anything failing the gate is not Trail talking. */
    if (req.body.path && !store.hasEvidenceFile(req.body.path)) {
      reply.code(403);
      return { error: "not an evidence file" };
    }
    const { spawn } = await import("node:child_process");
    const detached = { detached: true, stdio: "ignore" as const };
    /* a missing wt / code shim must not take the sidecar down */
    const guarded = (cmd: string, args: string[], windowsHide: boolean) => {
      const child = spawn(cmd, args, { ...detached, windowsHide });
      child.on("error", () => {});
      child.unref();
    };
    const kind = (req.body.kind ?? "file") as Artifact["kind"];
    const destination = destinationFor(kind, req.body.path);
    /* commits carry a sha, not a URL (dogfood r2): resolve the session
       project's remote into a commit URL; no remote -> git show in a
       terminal at the project. Best effort — an unpushed sha may 404. */
    if (kind === "commit" && req.body.sha) {
      const session = req.body.sessionId ? store.getSession(req.body.sessionId) : undefined;
      if (!session?.projectDir) return { ok: true };
      const url = commitUrl(await gitRemote(session.projectDir), req.body.sha);
      if (url) guarded("cmd", ["/c", "start", "", url], true);
      else guarded("wt", ["-d", session.projectDir, "git", "show", req.body.sha], false);
      return { ok: true };
    }
    const session = destination === "terminal" && req.body.sessionId
      ? store.getSession(req.body.sessionId)
      : undefined;
    if (session?.projectDir) {
      guarded("wt", ["-d", session.projectDir, "claude", "--resume", session.id], false);
    } else if (req.body.path && destination === "editor") {
      guarded("cmd", ["/c", "code", req.body.path], true);
    } else if (req.body.path && destination !== "terminal") {
      /* browser + viewer: the OS default handler is exactly the rule */
      guarded("cmd", ["/c", "start", "", req.body.path], true);
    }
    return { ok: true };
  });

  /* ---- inbox (D17): the attention queue, composed server-side ---- */

  app.get("/api/inbox", async () =>
    composeInbox(store.listTasks(), store.listSessions(), (taskId) => store.artifactsForTask(taskId))
  );

  /* Real previews for the Inbox tiles (D17): file bytes for paths the
     evidence log references — nothing else leaves the disk. excerpt=1
     clamps text to the tile's needs. */
  app.get<{ Querystring: { path?: string; excerpt?: string } }>("/api/artifacts/preview", async (req, reply) => {
    const p = req.query.path;
    if (!p || !store.hasEvidenceFile(p)) {
      reply.code(403);
      return { error: "not an evidence file" };
    }
    const { readFile } = await import("node:fs/promises");
    let bytes: Buffer;
    try {
      bytes = await readFile(p);
    } catch {
      reply.code(404);
      return { error: "file not found" };
    }
    const ext = p.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    const type =
      ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "svg" ? "image/svg+xml"
      : ext === "html" || ext === "htm" ? "text/html; charset=utf-8"
      : "text/plain; charset=utf-8";
    if (req.query.excerpt) {
      reply.header("content-type", "text/plain; charset=utf-8");
      return bytes.subarray(0, 4096).toString("utf8");
    }
    reply.header("content-type", type);
    return reply.send(bytes);
  });

  /* ---- objectives ---- */

  app.post<{ Body: { title: string; level: 1 | 2; parentId?: string; description?: string } }>(
    "/api/objectives",
    async (req) => store.createObjective(req.body)
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/objectives/:id",
    async (req) => store.updateObjective(req.params.id, req.body)
  );

  app.delete<{ Params: { id: string } }>("/api/objectives/:id", async (req) => {
    await store.deleteObjective(req.params.id);
    return { ok: true };
  });

  /* ---- reconciliation + progress (R6/D12) ---- */

  app.post<{ Body: { day?: string } | undefined }>("/api/recon/run", async (req) => {
    const day = req.body?.day ?? localDay(new Date().toISOString());
    return runRecon(store, day);
  });

  app.get("/api/progress", async () => ({ days: progressByDay(store) }));

  /* ---- dispatch (R8) ---- */

  app.post<{ Params: { id: string } }>("/api/tasks/:id/dispatch", async (req) => dispatcher.dispatch(req.params.id));

  /* ---- projects (first-class, D18; the list rides /api/bootstrap) ---- */

  app.post<{ Body: { name: string; dir?: string } }>("/api/projects", async (req, reply) => {
    if (!req.body?.name?.trim()) {
      reply.code(400);
      return { error: "a project needs a name" };
    }
    const project = await store.createProject({ name: req.body.name.trim(), dir: req.body.dir || undefined });
    /* a dir-bearing project is never excluded (D27) */
    await adoptStoreDirForProject(store, source, project.id);
    return store.getProject(project.id);
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/projects/:id",
    async (req) => {
      const project = await store.updateProject(req.params.id, req.body);
      await adoptStoreDirForProject(store, source, project.id);
      return store.getProject(project.id);
    }
  );

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (req) => {
    await store.deleteProject(req.params.id);
    return { ok: true };
  });

  /* Choose folder opens the OS folder dialog (dogfood r2, supersedes the
     D18 r1 in-app directory browser) — live-local only: the sidecar shares
     the operator's desktop, so the picker is the real system dialog.
     Blocks until the operator picks or cancels; cancel is not an error.
     pwsh (.NET) draws the modern dialog; Windows PowerShell is the
     fallback with the classic tree. */
  app.post<{ Body: { start?: string } }>("/api/fs/pick", async (req) => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const start = (req.body?.start ?? "").trim().replace(/'/g, "''");
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dlg = New-Object System.Windows.Forms.FolderBrowserDialog",
      "$dlg.ShowNewFolderButton = $true",
      start ? `$dlg.SelectedPath = '${start}'` : "",
      "$owner = New-Object System.Windows.Forms.Form", // unshown TopMost owner keeps the dialog in front of the browser
      "$owner.TopMost = $true",
      "if ($dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }"
    ].filter(Boolean).join("; ");
    const args = ["-NoProfile", "-STA", "-Command", script];
    const opts = { timeout: 300000, windowsHide: true };
    const run = promisify(execFile);
    let stdout = "";
    try {
      ({ stdout } = await run("pwsh", args, opts));
    } catch {
      try {
        ({ stdout } = await run("powershell", args, opts));
      } catch {
        return { canceled: true };
      }
    }
    const picked = stdout.trim();
    return picked ? { path: picked } : { canceled: true };
  });

  /* ---- agent-app connect (settings flow) ---- */

  app.get("/api/connect/scan", async () => ({ apps: await scanApps(store, source) }));

  /* windowed pre-import candidates for the connect modal's step 2 */
  app.get("/api/connect/projects", async () => ({ projects: await listConnectCandidates(source) }));

  app.post<{ Body: { app: AgentAppId; projects: ConnectSelection[] } }>("/api/connect", async (req, reply) => {
    /* selections are explicit — no default ever imports beyond them */
    if (req.body.app !== "claude-code" || !Array.isArray(req.body.projects)) {
      reply.code(400);
      return { ok: false, projects: 0, sessionsQueued: 0 };
    }
    return connectClaudeCode(store, source, req.body.projects);
  });

  app.post<{ Params: { id: string }; Body: { taskId: string; accept: boolean } }>(
    "/api/sessions/:id/suggestion",
    async (req) => {
      const session = store.getSession(req.params.id);
      if (!session) return { ok: false };
      if (req.body.accept) {
        await store.linkSession(req.body.taskId, session.id, "operator", "operator confirmed suggestion");
        await store.patchSession(session.id, { suggestions: [] });
      } else {
        await store.patchSession(session.id, {
          suggestions: session.suggestions.map((s) =>
            s.taskId === req.body.taskId ? { ...s, state: "dismissed" as const } : s
          )
        });
      }
      return { ok: true };
    }
  );

  /* ---- live updates ---- */

  app.get("/api/events", (req, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    reply.raw.write("retry: 2000\n\n");
    const onChange = (event: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    store.events.on("change", onChange);
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 25000);
    req.raw.on("close", () => {
      clearInterval(ping);
      store.events.off("change", onChange);
    });
  });
}

/* the origin remote, or "" — git missing or no remote is not an error */
async function gitRemote(dir: string): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  try {
    const { stdout } = await promisify(execFile)(
      "git",
      ["-C", dir, "config", "--get", "remote.origin.url"],
      { timeout: 5000, windowsHide: true }
    );
    return stdout.trim();
  } catch {
    return "";
  }
}
