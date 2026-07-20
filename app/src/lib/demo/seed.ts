import type {
  ActivityEvent, EvidenceEvent, Objective, Project, ReconRun, SessionRecord, Task
} from "../types";

/* Authored demo seed: one fictional day of an agent-native PM running an
   internal assistant pilot, with Trail holding the queue. Everything here
   is authored fiction; nothing derives from the real substrate, however
   sanitized. Deterministic so the demo tells the same story every load. */

export interface DemoData {
  tasks: Task[];
  objectives: Objective[];
  sessions: SessionRecord[];
  projects: Project[];
  recons: ReconRun[];
  activity: ActivityEvent[];
  evidence: EvidenceEvent[];
  /* tile previews, keyed by file-ref path: real renders of the seed's
     own file contents (D17 — never a fake preview) */
  previews: Record<string, { kind: "image" | "html" | "text"; content: string }>;
}

/* Three projects (§6.2): the research-lab analogue carries ~2 weeks of
   imported session history; the pilot repo holds the demo-day hero
   shapes; ops is folderless — the "No folder" chip and the no-dir
   dispatch refusal both need it. */
const DIRS = {
  lab: "~/repos/agent-workflow-lab",
  pilot: "~/repos/summarizer-pilot"
};

const slug = (dir: string) => dir.replace(/[~/]/g, "-");
const leaf = (dir: string) => dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;

const P = { lab: "p-lab", pilot: "p-pilot", ops: "p-ops" } as const;

function rng(n: number): number {
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* History pools, project-flavored: the lab reads as the research program
   the product came from; the pilot reads as rollout execution. */
const LAB_TITLES = [
  "Catalog prompt patterns from the team pilots", "Annotate transcripts for handoff friction",
  "Score wave-1 summaries against the rubric", "Interview a team lead about agent handoffs",
  "Summarize the parallel-dispatch study", "Draft the context-pack template",
  "Replay the failed dispatch traces", "Write up the interruption-cost findings",
  "Tag the transcript corpus by task shape", "Sketch the evidence-chain wireframe",
  "Test the two-pane review layout", "Prune the abandoned-session samples",
  "Map the handoff points in the review flow", "Time a week of context-switch costs",
  "Compare rubric scores across model versions", "Digest the team-lead interview notes",
  "Rebuild the sampler fixtures from wave 1", "Sort the transcript corpus by outcome"
];
const PILOT_TITLES = [
  "Onboard three teams to the pilot build", "Publish the week-1 pilot digest",
  "Tune the summary length heuristic", "Fix the sampler's timezone bug",
  "Set up the feedback intake form", "Triage the hallucinated-figure report",
  "Update the pilot runbook", "Brief the compliance reviewer",
  "Rotate the pilot API keys", "Wire the eval harness smoke test",
  "Draft the wave-2 cohort invite", "Close out the week-1 retro actions",
  "Publish the week-2 pilot digest", "Chase the missing team sign-ups",
  "Patch the intake form validation", "Answer the pilot channel questions",
  "Rerun the flaky eval smoke test", "Archive the wave-1 feedback thread",
  "Draft the wave-2 midpoint note", "Fix the digest's broken team links"
];
const OPS_TITLES = [
  "Chase the access-request approvals", "Update the steering-committee deck",
  "File the vendor security questionnaire", "Book the wave-3 kickoff room",
  "Collect the team-lead availability grid", "Draft the pilot budget note"
];

export function buildDemoData(today = new Date()): DemoData {
  const day = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return toDay(d);
  };
  const iso = (offset: number, h: number, m = 0) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, h, m);
    return d.toISOString();
  };

  /* two L1s, four L2s — §4.2's tree in fictional analogue */
  const objectives: Objective[] = [
    { id: "o-pilot", level: 1, title: "Ship the summarizer pilot to the teams", state: "planned", createdAt: iso(-24, 9) },
    { id: "o-wave2", level: 2, parentId: "o-pilot", title: "Run the wave-2 pilot cohort", state: "planned", createdAt: iso(-21, 9) },
    { id: "o-eval", level: 2, parentId: "o-pilot", title: "Stand up the evaluation harness", state: "planned", createdAt: iso(-21, 9) },
    { id: "o-agent", level: 1, title: "Run product the agent-native way", state: "planned", createdAt: iso(-24, 9) },
    { id: "o-toolkit", level: 2, parentId: "o-agent", title: "Prototype the workflow toolkit", state: "planned", createdAt: iso(-18, 9) },
    { id: "o-readout", level: 2, parentId: "o-agent", title: "Package the leadership readout", state: "planned", createdAt: iso(-14, 9) }
  ];

  const projects: Project[] = [
    { id: P.lab, name: leaf(DIRS.lab), dir: DIRS.lab, storeDir: slug(DIRS.lab), source: "claude-code", createdAt: iso(-17, 9) },
    { id: P.pilot, name: leaf(DIRS.pilot), dir: DIRS.pilot, storeDir: slug(DIRS.pilot), source: "claude-code", createdAt: iso(-13, 9) },
    { id: P.ops, name: "Rollout ops", createdAt: iso(-15, 9) }
  ];

  const tasks: Task[] = [];
  const activity: ActivityEvent[] = [];
  const evidence: EvidenceEvent[] = [];
  const sessions: SessionRecord[] = [];
  let seq = 0;
  const nid = (p: string) => `${p}-${(seq++).toString(36)}`;

  const addActivity = (a: Omit<ActivityEvent, "id">) => activity.push({ ...a, id: nid("a") });

  const addTask = (input: Partial<Task> & { title: string }, done?: { at: string }): Task => {
    const task: Task = {
      id: nid("t"),
      title: input.title,
      description: input.description,
      objectiveId: input.objectiveId,
      projectId: input.projectId,
      date: input.date,
      status: input.status ?? "planned",
      createdAt: input.createdAt ?? iso(-1, 18),
      updatedAt: done?.at ?? input.createdAt ?? iso(-1, 18),
      statusAt: done?.at ?? input.createdAt ?? iso(-1, 18),
      linkedSessionIds: []
    };
    tasks.push(task);
    addActivity({ taskId: task.id, kind: "created", by: "operator", at: task.createdAt });
    if (done) {
      task.status = "done";
      addActivity({ taskId: task.id, kind: "status", from: "planned", to: "done", by: "operator", at: done.at });
    }
    return task;
  };

  const mkSession = (input: Partial<SessionRecord> & { id: string; projectDir: string; startedAt: string; lastActiveAt: string }): SessionRecord => {
    const record: SessionRecord = {
      storeDir: slug(input.projectDir),
      file: `${input.id}.jsonl`,
      liveStatus: "closed",
      suggestions: [],
      harvestState: "full",
      imported: true,
      ...input
    } as SessionRecord;
    sessions.push(record);
    return record;
  };

  const gen = "seed";
  const ev = (e: Omit<EvidenceEvent, "id" | "gen">) => evidence.push({ ...e, id: nid("e"), gen });

  /* ---- today's board: every column inhabited at first load ---- */

  /* planned — dispatch fodder; the ops one exercises the no-dir refusal */
  addTask({ title: "Book wave-3 team interviews", description: "Five interview slots across the teams that skipped wave 2; aim for two skeptics.", objectiveId: "o-wave2", projectId: P.pilot, date: day(0), createdAt: iso(-1, 18, 20) });
  addTask({ title: "Draft the rollout comms note", objectiveId: "o-readout", projectId: P.ops, date: day(0), createdAt: iso(-1, 18, 22) });
  addTask({ title: "Triage the week's pilot bug reports", objectiveId: "o-wave2", projectId: P.pilot, date: day(0), createdAt: iso(0, 8, 15) });

  /* running — two live sessions, the parallel-attention story */
  const harness = addTask({
    title: "Wire the eval harness to the transcript sampler",
    description: "Harness pulls scored samples straight from the sampler output; no hand-copied fixtures.",
    objectiveId: "o-eval", projectId: P.lab, date: day(0), status: "running", createdAt: iso(-1, 17, 10)
  });
  addActivity({ taskId: harness.id, kind: "dispatched", by: "operator", at: iso(0, 9, 58) });
  addActivity({ taskId: harness.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(0, 9, 58) });
  addActivity({ taskId: harness.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 9, 59) });
  harness.statusAt = iso(0, 9, 59);

  const catalog = addTask({
    title: "Backfill the prompt-pattern catalog", objectiveId: "o-toolkit", projectId: P.lab,
    date: day(0), status: "running", createdAt: iso(0, 10, 30)
  });
  addActivity({ taskId: catalog.id, kind: "linked", by: "automation", note: "watcher: session in project dir", at: iso(0, 10, 41) });
  addActivity({ taskId: catalog.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 10, 41) });
  catalog.statusAt = iso(0, 10, 41);

  /* waiting — the terminal-native hero (no dispatch event: the watcher
     found it) plus a second card so the queue reads as a queue */
  const redact = addTask({
    title: "Prototype the transcript-redaction pre-processor",
    description: "Strip identifying strings from pilot transcripts before they enter the shared eval set.",
    objectiveId: "o-toolkit", projectId: P.pilot, date: day(0), status: "waiting", createdAt: iso(0, 11, 0)
  });
  addActivity({ taskId: redact.id, kind: "linked", by: "automation", note: "watcher: session in project dir", at: iso(0, 11, 4) });
  addActivity({ taskId: redact.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 11, 4) });
  addActivity({ taskId: redact.id, kind: "status", from: "running", to: "waiting", by: "automation", note: "agent asked a question", at: iso(0, 14, 5) });
  redact.statusAt = iso(0, 14, 5);

  const faq = addTask({ title: "Refresh the pilot FAQ from week-2 questions", objectiveId: "o-wave2", projectId: P.pilot, date: day(0), status: "waiting", createdAt: iso(-1, 16, 40) });
  addActivity({ taskId: faq.id, kind: "dispatched", by: "operator", at: iso(0, 13, 30) });
  addActivity({ taskId: faq.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(0, 13, 30) });
  addActivity({ taskId: faq.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 13, 31) });
  addActivity({ taskId: faq.id, kind: "status", from: "running", to: "waiting", by: "automation", note: "agent asked a question", at: iso(0, 15, 12) });
  faq.statusAt = iso(0, 15, 12);

  /* ready — the sign-off queue: three heroes, statusAt distinct so the
     oldest-first order is visibly correct (D17) */
  const themes = addTask({
    title: "Synthesize wave-2 pilot feedback into themes",
    description: "Thirty raw comments from nine teams into a themes memo the readout can quote.",
    objectiveId: "o-wave2", projectId: P.pilot, date: day(0), status: "ready", createdAt: iso(-2, 18, 5)
  });
  addActivity({ taskId: themes.id, kind: "dispatched", by: "operator", at: iso(0, 9, 12) });
  addActivity({ taskId: themes.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(0, 9, 12) });
  addActivity({ taskId: themes.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 9, 13) });
  addActivity({ taskId: themes.id, kind: "status", from: "running", to: "ready", by: "automation", note: "session closed claiming done", at: iso(0, 9, 38) });
  themes.statusAt = iso(0, 9, 38);

  const adoption = addTask({
    title: "Chart wave-2 adoption for the readout",
    objectiveId: "o-readout", projectId: P.pilot, date: day(0), status: "ready", createdAt: iso(-1, 18, 10)
  });
  addActivity({ taskId: adoption.id, kind: "dispatched", by: "operator", at: iso(0, 10, 20) });
  addActivity({ taskId: adoption.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(0, 10, 20) });
  addActivity({ taskId: adoption.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 10, 21) });
  addActivity({ taskId: adoption.id, kind: "status", from: "running", to: "ready", by: "automation", note: "session closed claiming done", at: iso(0, 10, 52) });
  adoption.statusAt = iso(0, 10, 52);

  const sampler = addTask({
    title: "Land the session-sampler config change",
    objectiveId: "o-eval", projectId: P.lab, date: day(0), status: "ready", createdAt: iso(-3, 9, 40)
  });
  addActivity({ taskId: sampler.id, kind: "dispatched", by: "operator", at: iso(0, 12, 40) });
  addActivity({ taskId: sampler.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(0, 12, 40) });
  addActivity({ taskId: sampler.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(0, 12, 41) });
  addActivity({ taskId: sampler.id, kind: "status", from: "running", to: "ready", by: "automation", note: "session closed claiming done", at: iso(0, 13, 15) });
  sampler.statusAt = iso(0, 13, 15);

  /* done hero — the full lifecycle timeline, operator/automation mix,
     only the final move by a human hand (D8/D11) */
  const policy = addTask({
    title: "Draft the redaction policy one-pager",
    description: "What the pre-processor strips, what it keeps, and who signs off on exceptions.",
    objectiveId: "o-toolkit", projectId: P.pilot, date: day(0), status: "planned", createdAt: iso(-4, 9, 20)
  });
  addActivity({ taskId: policy.id, kind: "dispatched", by: "operator", at: iso(-1, 9, 30) });
  addActivity({ taskId: policy.id, kind: "linked", by: "automation", note: "dispatch marker", at: iso(-1, 9, 30) });
  addActivity({ taskId: policy.id, kind: "status", from: "planned", to: "running", by: "automation", at: iso(-1, 9, 31) });
  addActivity({ taskId: policy.id, kind: "status", from: "running", to: "waiting", by: "automation", note: "agent asked a question", at: iso(-1, 11, 12) });
  addActivity({ taskId: policy.id, kind: "status", from: "waiting", to: "running", by: "automation", at: iso(-1, 11, 40) });
  addActivity({ taskId: policy.id, kind: "status", from: "running", to: "ready", by: "automation", note: "session closed claiming done", at: iso(-1, 15, 22) });
  addActivity({ taskId: policy.id, kind: "status", from: "ready", to: "done", by: "operator", at: iso(0, 8, 45) });
  policy.status = "done";
  policy.statusAt = iso(0, 8, 45);
  policy.updatedAt = policy.statusAt;

  addTask({ title: "Answer the team-lead access questions", projectId: P.ops, date: day(0), createdAt: iso(0, 8, 0) }, { at: iso(0, 9, 5) });

  /* upcoming + shelved (Backlog's filter fodder) */
  addTask({ title: "Draft the wave-3 rollout checklist", objectiveId: "o-wave2", projectId: P.pilot, date: day(1), createdAt: iso(0, 9, 45) });
  addTask({ title: "Walk compliance through the eval set", objectiveId: "o-eval", projectId: P.pilot, date: day(2), createdAt: iso(0, 9, 46) });
  addTask({ title: "Evaluate the third-party eval vendor", objectiveId: "o-eval", projectId: P.lab, status: "shelved", createdAt: iso(-12, 10) });
  addTask({ title: "Spike a chat digest bot for the teams", projectId: P.lab, status: "shelved", createdAt: iso(-9, 10) });

  /* ---- sessions: the heroes' substrate ---- */
  const sHarness = mkSession({ id: "s-harness", projectDir: DIRS.lab, startedAt: iso(0, 9, 58), lastActiveAt: iso(0, 11, 20), liveStatus: "running", taskId: harness.id, title: "Wire the eval harness" });
  harness.linkedSessionIds.push(sHarness.id);
  const sCatalog = mkSession({ id: "s-catalog", projectDir: DIRS.lab, startedAt: iso(0, 10, 41), lastActiveAt: iso(0, 11, 15), liveStatus: "running", taskId: catalog.id, title: "Backfill the prompt-pattern catalog" });
  catalog.linkedSessionIds.push(sCatalog.id);

  mkSession({
    id: "s-redact", projectDir: DIRS.pilot, startedAt: iso(0, 11, 4), lastActiveAt: iso(0, 14, 5),
    taskId: redact.id, title: "Transcript-redaction pre-processor", liveStatus: "waiting",
    /* the Inbox waiting card's body: the agent's real question, near the
       500-char harvest clamp, carrying inline markdown (D19.6) */
    lastAgentMessage:
      "Scope check before I write code: the wave-2 transcripts in `fixtures/wave2/` carry four identifier kinds — team names, engineer handles, ticket IDs, and file paths. I can mask **all four** behind stable placeholders, or keep ticket IDs so reviewers can cross-reference the tracker. Masking everything is safer but breaks the audit trail; keeping IDs leaks codenames into the shared eval set. Which trade should I take? I'll wire the pass into `pipeline/redact.ts` either way."
  });
  redact.linkedSessionIds.push("s-redact");

  mkSession({
    id: "s-faq", projectDir: DIRS.pilot, startedAt: iso(0, 13, 30), lastActiveAt: iso(0, 15, 12),
    taskId: faq.id, title: "Refresh the pilot FAQ", liveStatus: "waiting",
    lastAgentMessage:
      "Week-2 questions sorted — 14 of 31 are variants of **\"can it see our internal wiki?\"** The draft answer says no until the connector ships. Confirm that's still the line and I'll publish the FAQ update."
  });
  faq.linkedSessionIds.push("s-faq");

  /* every closed ready session carries its closing claim: the sign-off
     card's fallback evidence whenever its artifact strip is empty (D25) */
  const sThemes = mkSession({
    id: "s-themes", projectDir: DIRS.pilot, startedAt: iso(0, 9, 12), lastActiveAt: iso(0, 9, 38),
    taskId: themes.id, title: "Synthesize wave-2 feedback",
    lastAgentMessage: "Themes memo drafted: three themes carry 24 of 30 comments — latency on long transcripts, missing tracker links, and \"where did my summary go\" navigation. Full memo in `wave2-themes.md`, quotes attributed by team."
  });
  themes.linkedSessionIds.push(sThemes.id);
  const sAdoption = mkSession({
    id: "s-adoption", projectDir: DIRS.pilot, startedAt: iso(0, 10, 20), lastActiveAt: iso(0, 10, 52),
    taskId: adoption.id, title: "Chart wave-2 adoption",
    lastAgentMessage: "Adoption chart done: nine teams plotted week-over-week, six trending up, the two wave-2 skeptic teams flat. Chart exported for the readout deck."
  });
  adoption.linkedSessionIds.push(sAdoption.id);
  const sSampler = mkSession({
    id: "s-sampler", projectDir: DIRS.lab, startedAt: iso(0, 12, 40), lastActiveAt: iso(0, 13, 15),
    taskId: sampler.id, title: "Session-sampler config",
    lastAgentMessage: "Config change landed: the sampler now weights by session length instead of uniform draw, so long transcripts stop drowning the eval set. Committed with the test updated."
  });
  sampler.linkedSessionIds.push(sSampler.id);
  const sPolicy = mkSession({ id: "s-policy", projectDir: DIRS.pilot, startedAt: iso(-1, 9, 30), lastActiveAt: iso(-1, 15, 22), taskId: policy.id, title: "Redaction policy one-pager" });
  policy.linkedSessionIds.push(sPolicy.id);

  /* the pending link suggestion (D18: task-modal-only home) — an unlinked
     notes session pointing at the themes hero */
  mkSession({
    id: "s-notes", projectDir: DIRS.pilot, startedAt: iso(-1, 14, 0), lastActiveAt: iso(-1, 14, 44),
    title: "Week-2 team notes",
    suggestions: [{ taskId: themes.id, confidence: 0.64, reason: "same directory + overlapping goal", state: "pending" }]
  });
  /* drift: an unlinked session from today, tomorrow's recon will flag it */
  mkSession({ id: "s-drift", projectDir: DIRS.pilot, startedAt: iso(0, 15, 40), lastActiveAt: iso(0, 16, 5), title: "Poking at the sampler flags" });

  /* ---- evidence: full chains behind every hero (D20.4 — commits stay
     timeline rows; only files + PR links reach the artifact strip) ---- */
  const NOTES_PATH = "~/repos/summarizer-pilot/docs/wave2-themes.md";
  const CHART_PATH = "~/repos/summarizer-pilot/readout/adoption-wave2.svg";
  const POLICY_PATH = "~/repos/summarizer-pilot/docs/redaction-policy.md";
  const FLOW_PATH = "~/repos/summarizer-pilot/docs/redaction-flow.html";

  ev({ sessionId: sThemes.id, taskId: themes.id, kind: "first-prompt", payload: { text: "Synthesize wave-2 pilot feedback into themes" }, source: { file: sThemes.file, line: 1 }, at: iso(0, 9, 12) });
  ev({ sessionId: sThemes.id, taskId: themes.id, kind: "commit-ref", payload: { sha: "4e19b2d", subject: "tally the wave-2 comments by team" }, source: { file: sThemes.file, line: 38 }, at: iso(0, 9, 24) });
  ev({ sessionId: sThemes.id, taskId: themes.id, kind: "file-ref", payload: { path: NOTES_PATH, tool: "Write" }, source: { file: sThemes.file, line: 52 }, at: iso(0, 9, 31) });
  ev({ sessionId: sThemes.id, taskId: themes.id, kind: "outcome-claim", payload: { text: "Themes memo written; three themes, tally attached", via: "llm" }, source: { file: sThemes.file, line: 84 }, at: iso(0, 9, 38) });
  ev({ sessionId: sThemes.id, taskId: themes.id, kind: "segment", payload: { label: "Synthesize wave-2 feedback", file: sThemes.file }, source: { file: sThemes.file, line: 1 }, at: iso(0, 9, 38) });

  ev({ sessionId: sAdoption.id, taskId: adoption.id, kind: "commit-ref", payload: { sha: "b7c04aa", subject: "chart weekly active reviewers" }, source: { file: sAdoption.file, line: 29 }, at: iso(0, 10, 40) });
  ev({ sessionId: sAdoption.id, taskId: adoption.id, kind: "file-ref", payload: { path: CHART_PATH, tool: "Write" }, source: { file: sAdoption.file, line: 41 }, at: iso(0, 10, 47) });
  ev({ sessionId: sAdoption.id, taskId: adoption.id, kind: "segment", payload: { label: "Chart wave-2 adoption", file: sAdoption.file }, source: { file: sAdoption.file, line: 1 }, at: iso(0, 10, 52) });

  ev({ sessionId: sSampler.id, taskId: sampler.id, kind: "commit-ref", payload: { sha: "91d33f0", subject: "sample by task shape, not recency" }, source: { file: sSampler.file, line: 22 }, at: iso(0, 12, 55) });
  ev({ sessionId: sSampler.id, taskId: sampler.id, kind: "commit-ref", payload: { sha: "c5a8e17", subject: "cap per-team sample weight" }, source: { file: sSampler.file, line: 47 }, at: iso(0, 13, 4) });
  ev({ sessionId: sSampler.id, taskId: sampler.id, kind: "pr-ref", payload: { url: "https://github.com/demo/agent-workflow-lab/pull/41", label: "#41" }, source: { file: sSampler.file, line: 63 }, at: iso(0, 13, 12) });
  ev({ sessionId: sSampler.id, taskId: sampler.id, kind: "outcome-claim", payload: { text: "Config landed behind PR #41", via: "llm" }, source: { file: sSampler.file, line: 70 }, at: iso(0, 13, 15) });
  ev({ sessionId: sSampler.id, taskId: sampler.id, kind: "segment", payload: { label: "Session-sampler config", file: sSampler.file }, source: { file: sSampler.file, line: 1 }, at: iso(0, 13, 15) });

  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "first-prompt", payload: { text: "Draft the redaction policy one-pager" }, source: { file: sPolicy.file, line: 1 }, at: iso(-1, 9, 30) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "commit-ref", payload: { sha: "0f2d9c1", subject: "docs: redaction policy draft" }, source: { file: sPolicy.file, line: 58 }, at: iso(-1, 14, 50) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "file-ref", payload: { path: POLICY_PATH, tool: "Write" }, source: { file: sPolicy.file, line: 61 }, at: iso(-1, 14, 55) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "file-ref", payload: { path: FLOW_PATH, tool: "Write" }, source: { file: sPolicy.file, line: 66 }, at: iso(-1, 15, 5) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "pr-ref", payload: { url: "https://github.com/demo/summarizer-pilot/pull/17", label: "#17" }, source: { file: sPolicy.file, line: 74 }, at: iso(-1, 15, 18) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "outcome-claim", payload: { text: "One-pager and flow diagram drafted; PR open", via: "llm" }, source: { file: sPolicy.file, line: 80 }, at: iso(-1, 15, 22) });
  ev({ sessionId: sPolicy.id, taskId: policy.id, kind: "segment", payload: { label: "Redaction policy one-pager", file: sPolicy.file }, source: { file: sPolicy.file, line: 1 }, at: iso(-1, 15, 22) });

  /* friction + candidate lessons (D6 substrate — stored, no surface yet) */
  ev({ sessionId: "s-redact", kind: "friction", payload: { text: "Re-explained the redaction scope in three separate sessions" }, source: { file: "s-redact.jsonl", line: 9 }, at: iso(0, 14, 5) });
  ev({ sessionId: "s-redact", kind: "lesson", payload: { text: "Pin the redaction scope doc into the project context" }, source: { file: "s-redact.jsonl", line: 9 }, at: iso(0, 14, 5) });
  ev({ sessionId: "s-notes", kind: "friction", payload: { text: "Team feedback arrives in four formats; normalizing eats the first hour" }, source: { file: "s-notes.jsonl", line: 14 }, at: iso(-1, 14, 44) });
  ev({ sessionId: "s-notes", kind: "lesson", payload: { text: "Standardize the feedback intake template for wave 3" }, source: { file: "s-notes.jsonl", line: 14 }, at: iso(-1, 14, 44) });

  /* ---- previews: real renders of the seed's own file bodies ---- */
  const previews: DemoData["previews"] = {
    [NOTES_PATH]: {
      kind: "text",
      content: [
        "# Wave-2 feedback — themes",
        "",
        "Thirty comments, nine teams. Three themes carry 24 of 30.",
        "",
        "## 1. Trust the prose, verify the numbers (11)",
        "Reviewers accept the summary text but re-check every figure",
        "by hand. Ask: inline source links on numeric claims.",
        "",
        "## 2. The appendix is invisible (7)",
        "Long documents truncate before appendices; two teams call the",
        "summaries \"confidently partial\".",
        "",
        "## 3. Wanted: diff against wave-1 (6)",
        "Repeat submitters dominate; reviewers want what changed, not",
        "what is. Full tally: fixtures/wave2/tally.csv"
      ].join("\n")
    },
    [CHART_PATH]: {
      kind: "image",
      content:
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 180\">" +
        "<rect width=\"320\" height=\"180\" fill=\"#fafafa\"/>" +
        "<text x=\"16\" y=\"26\" font-family=\"sans-serif\" font-size=\"12\" fill=\"#444\">Weekly active reviewers — wave 2</text>" +
        "<g fill=\"#b9c2d0\">" +
        "<rect x=\"28\" y=\"128\" width=\"32\" height=\"22\"/>" +
        "<rect x=\"76\" y=\"108\" width=\"32\" height=\"42\"/>" +
        "<rect x=\"124\" y=\"92\" width=\"32\" height=\"58\"/>" +
        "<rect x=\"172\" y=\"70\" width=\"32\" height=\"80\"/>" +
        "<rect x=\"220\" y=\"56\" width=\"32\" height=\"94\"/>" +
        "</g>" +
        "<rect x=\"268\" y=\"38\" width=\"32\" height=\"112\" fill=\"#5b6b8c\"/>" +
        "<line x1=\"16\" y1=\"150\" x2=\"304\" y2=\"150\" stroke=\"#d5d9e0\"/>" +
        "<text x=\"16\" y=\"168\" font-family=\"sans-serif\" font-size=\"10\" fill=\"#888\">w1</text>" +
        "<text x=\"292\" y=\"168\" font-family=\"sans-serif\" font-size=\"10\" fill=\"#888\">w6</text>" +
        "</svg>"
    },
    [POLICY_PATH]: {
      kind: "text",
      content: [
        "# Redaction policy — one page",
        "",
        "The pre-processor strips before anything enters the shared",
        "eval set. Default: mask; exceptions are signed, not assumed.",
        "",
        "Always masked: team names, engineer handles, file paths.",
        "Kept with sign-off: ticket IDs (audit-trail exception).",
        "Never stored: raw transcripts outside the pilot enclave."
      ].join("\n")
    },
    [FLOW_PATH]: {
      kind: "html",
      content:
        "<body style=\"font:13px/1.5 Roboto,sans-serif;color:#252525;margin:16px\">" +
        "<h2 style=\"font-weight:400\">Redaction pass order</h2>" +
        "<table border=1 cellpadding=6 style=\"border-collapse:collapse;border-color:#e1e1e3\">" +
        "<tr><th>Pass</th><th>Targets</th><th>Action</th></tr>" +
        "<tr><td>1</td><td>team names, handles</td><td>stable placeholder</td></tr>" +
        "<tr><td>2</td><td>file paths</td><td>basename only</td></tr>" +
        "<tr><td>3</td><td>ticket IDs</td><td>keep (signed exception)</td></tr>" +
        "</table></body>"
    }
  };

  /* ---- the history arc: ~3 weeks (§6.2), the lab's two imported weeks
     plus pilot execution — all acknowledged Done, so today's Inbox holds
     only today's queue ---- */
  /* each history title appears once across the whole window — repeats
     read generated, and the seed must read authored (D21) */
  const used = new Set<string>();
  const draw = (pool: string[], r: number): string | undefined => {
    const start = Math.floor(r * 1000) % pool.length;
    for (let probe = 0; probe < pool.length; probe++) {
      const t = pool[(start + probe) % pool.length];
      if (!used.has(t)) return t;
    }
    return undefined;
  };
  const historyPick = (offset: number, i: number): { title: string; projectId: string; objectiveId?: string } | undefined => {
    const r = rng(offset * 31 + i * 7 + 11);
    if (r < 0.18) {
      const t = draw(OPS_TITLES, r);
      /* a handful objective-less: filter and bulk fodder */
      return t ? { title: t, projectId: P.ops, objectiveId: r < 0.09 ? undefined : "o-readout" } : undefined;
    }
    if (offset >= -16 && offset <= -3 && r < 0.62) {
      const t = draw(LAB_TITLES, r);
      return t ? { title: t, projectId: P.lab, objectiveId: r < 0.3 ? "o-toolkit" : "o-eval" } : undefined;
    }
    const t = draw(PILOT_TITLES, r) ?? draw(LAB_TITLES, r);
    return t ? { title: t, projectId: P.pilot, objectiveId: r < 0.45 ? "o-wave2" : "o-eval" } : undefined;
  };

  for (let offset = -20; offset < 0; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const r = rng((offset + 40) * 2654435761 % 2147483647);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    let count = isWeekend ? (r < 0.7 ? 0 : 1) : 1 + Math.floor(r * 3.6);
    if (offset === -1) count = 3;
    for (let i = 0; i < count; i++) {
      const pick = historyPick(offset, i);
      if (!pick) continue; /* pools drained — better thin days than repeats */
      used.add(pick.title);
      const task = addTask(
        { ...pick, date: toDay(d), createdAt: iso(offset, 9) },
        { at: iso(offset, 10 + i * 2, (i * 17) % 60 ) }
      );
      /* the lab's imported story: sessions with titles and durations
         behind its history (§6.2 sessions row) */
      if (pick.projectId === P.lab) {
        const sid = `s-hist-${offset + 40}-${i}`;
        mkSession({
          id: sid, projectDir: DIRS.lab, startedAt: iso(offset, 9 + i, 5),
          lastActiveAt: iso(offset, 9 + i, 5 + 25 + Math.floor(rng(offset * 13 + i) * 50)),
          taskId: task.id, title: pick.title
        });
        task.linkedSessionIds.push(sid);
      }
    }
  }

  /* ---- nightly recons across the heat window (D15) ---- */
  const recons: ReconRun[] = [];
  for (let offset = -20; offset < 0; offset++) {
    const dayStr = day(offset);
    const dayTasks = tasks.filter((t) => t.date === dayStr && t.status !== "shelved");
    if (dayTasks.length === 0) continue;
    recons.push({
      id: `r-${20 + offset}`,
      day: dayStr,
      at: iso(offset + 1, 0, 5),
      results: dayTasks.map((t) => ({ taskId: t.id, verdict: t.status === "done" ? "confirmed" : "open" })),
      drift: offset === -1 ? [{ sessionId: "s-notes", title: "Week-2 team notes" }] : [],
      rollovers: dayTasks.filter((t) => t.status !== "done").map((t) => t.id)
    });
  }

  return { tasks, objectives, sessions, projects, recons, activity, evidence, previews };
}
