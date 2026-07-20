/* Fixture builders mirroring the real Claude Code transcript shapes
   (verified against the live store, CC v2.1.x). */

/* Hermetic by default: never scan the dev machine's real desktop-app
   session store during tests; suites that want it point the override at
   their own fixture dir. */
process.env.TRAIL_DESKTOP_SESSIONS_ROOT ??= "Z:\\trail-tests-no-desktop-store";

export function fixtureSession(opts: {
  sessionId: string;
  cwd: string;
  firstPrompt: string;
  title?: string;
  editPath?: string;
  commit?: { sha: string; subject: string };
  pr?: { url: string; number: number };
  startedAt?: string;
  lastText?: string;
}): string {
  const ts = opts.startedAt ?? "2026-07-15T08:00:00.000Z";
  const base = { sessionId: opts.sessionId, cwd: opts.cwd, gitBranch: "main", isSidechain: false, userType: "external", version: "2.1.205" };
  const lines: unknown[] = [
    { type: "user", ...base, timestamp: ts, uuid: "u1", parentUuid: null, message: { role: "user", content: opts.firstPrompt } },
    { type: "assistant", ...base, timestamp: ts, uuid: "a1", parentUuid: "u1", message: { role: "assistant", content: [{ type: "text", text: "On it." }] } }
  ];
  if (opts.title) lines.push({ type: "custom-title", sessionId: opts.sessionId, customTitle: opts.title });
  if (opts.editPath) {
    lines.push({
      type: "assistant", ...base, timestamp: ts, uuid: "a2", parentUuid: "a1",
      message: { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: opts.editPath } }] }
    });
  }
  if (opts.commit) {
    lines.push({
      type: "assistant", ...base, timestamp: ts, uuid: "a3", parentUuid: "a2",
      message: { role: "assistant", content: [{ type: "tool_use", id: "t2", name: "Bash", input: { command: "git commit -m x" } }] }
    });
    lines.push({
      type: "user", ...base, timestamp: ts, uuid: "u2", parentUuid: "a3",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: `[main ${opts.commit.sha}] ${opts.commit.subject}` }] }
    });
  }
  if (opts.pr) {
    lines.push({ type: "pr-link", sessionId: opts.sessionId, timestamp: ts, prUrl: opts.pr.url, prNumber: opts.pr.number, prRepository: "x/y" });
  }
  lines.push({
    type: "assistant", ...base, timestamp: ts, uuid: "a9", parentUuid: "u2",
    message: { role: "assistant", content: [{ type: "text", text: opts.lastText ?? "Done. Shipped the change and committed it." }] }
  });
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}

/* A stillborn transcript: the queued prompt landed, the reply never did
   (app restart re-dispatches the queue into a fresh session file). Real
   shape verified 2026-07-16 against the live store — queue-operation and
   prompt records only, zero assistant turns. */
export function fixtureStillbornSession(opts: { sessionId: string; cwd: string; firstPrompt: string }): string {
  const ts = "2026-07-15T08:00:00.000Z";
  const base = { sessionId: opts.sessionId, cwd: opts.cwd, gitBranch: "main", isSidechain: false, userType: "external", version: "2.1.205" };
  const lines: unknown[] = [
    { type: "queue-operation", operation: "enqueue", timestamp: ts, sessionId: opts.sessionId, content: opts.firstPrompt },
    { type: "user", ...base, timestamp: ts, uuid: "u1", parentUuid: null, message: { role: "user", content: opts.firstPrompt } },
    { type: "last-prompt", sessionId: opts.sessionId, lastPrompt: opts.firstPrompt }
  ];
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}
