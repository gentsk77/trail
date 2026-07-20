import type { EvidenceEvent, SessionRecord } from "../../src/lib/types";
import type { ParsedSession } from "../adapters/sessions/types";
import { liveStatusFrom } from "../adapters/sessions/types";
import type { Store } from "../store/db";
import { evidenceFrom, suggestLinks } from "./heuristic";
import type { LlmExtractor } from "./llm";

/* Harvest orchestrator: one pass per session (R5). Heuristic extraction
   always lands; the language pass rides the same harvest generation so
   readers never see a half-pass. LLM failure degrades to heuristic-only. */

export interface HarvestOptions {
  imported: boolean;
  llm?: LlmExtractor;
}

export async function harvestSession(store: Store, parsed: ParsedSession, opts: HarvestOptions): Promise<SessionRecord> {
  const gen = new Date().toISOString();
  const events: Omit<EvidenceEvent, "id">[] = evidenceFrom(parsed, gen);
  const at = parsed.lastActiveAt;
  const src = { file: parsed.file, line: 1 };

  const linkedTaskId = parsed.markerTaskId && store.getTask(parsed.markerTaskId) ? parsed.markerTaskId : undefined;

  const dirOf = (t: { projectId?: string }) => (t.projectId ? store.getProject(t.projectId)?.dir : undefined);

  let harvestState: SessionRecord["harvestState"] = "heuristic";
  let llmLinks: SessionRecord["suggestions"] = [];
  if (opts.llm) {
    try {
      const openTasks = store.listTasks().filter((t) => t.status !== "done" && t.status !== "shelved");
      const out = await opts.llm(parsed, openTasks, dirOf);
      for (const claim of out.claims) {
        events.push({ sessionId: parsed.id, kind: "outcome-claim", payload: { text: claim.text.slice(0, 300), via: "llm" }, source: src, gen, at });
      }
      for (const friction of out.friction) {
        events.push({ sessionId: parsed.id, kind: "friction", payload: { text: friction.slice(0, 300) }, source: src, gen, at });
      }
      for (const lesson of out.lessons) {
        events.push({ sessionId: parsed.id, kind: "lesson", payload: { text: lesson.slice(0, 300) }, source: src, gen, at });
      }
      llmLinks = out.links
        .filter((l) => store.getTask(l.taskId))
        .map((l) => ({ taskId: l.taskId, confidence: Number(l.confidence.toFixed(2)), reason: l.reason ?? "language pass", state: "pending" as const }));
      harvestState = "full";
    } catch {
      harvestState = "heuristic-only";
    }
  }

  if (linkedTaskId) for (const e of events) e.taskId = linkedTaskId;
  await store.appendEvidence(events);

  const existing = store.getSession(parsed.id);
  const suggestions = linkedTaskId || existing?.taskId
    ? []
    : existing?.suggestions?.some((s) => s.state !== "pending")
      ? existing.suggestions
      : llmLinks.length > 0
        ? llmLinks
        : suggestLinks(parsed, store.listTasks(), dirOf);

  const record: SessionRecord = {
    id: parsed.id,
    projectDir: parsed.projectDir,
    storeDir: parsed.storeDir,
    file: parsed.file,
    startedAt: parsed.startedAt,
    lastActiveAt: parsed.lastActiveAt,
    liveStatus: liveStatusFrom(parsed.lastActiveAt, parsed.awaitingInput),
    awaitingInput: parsed.awaitingInput,
    title: parsed.title,
    firstPrompt: parsed.firstPrompt?.slice(0, 500),
    /* a torn read can miss the tail; the last good message stands */
    lastAgentMessage: parsed.lastAssistantText?.slice(0, 500) ?? existing?.lastAgentMessage,
    taskId: existing?.taskId ?? linkedTaskId,
    suggestions,
    harvestState,
    imported: opts.imported || (existing?.imported ?? false)
  };
  await store.upsertSession(record);

  if (linkedTaskId && !existing?.taskId) {
    await store.linkSession(linkedTaskId, parsed.id, "automation", "dispatch marker");
  }
  return record;
}

/* Serialized queue: LLM passes run one at a time; progress lands on the
   session record and streams out over SSE via store events. */
export class HarvestQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(private store: Store, private llm?: LlmExtractor) {}

  get size(): number {
    return this.pending;
  }

  push(parsed: ParsedSession, imported: boolean): Promise<SessionRecord> {
    this.pending += 1;
    const run = this.chain.then(async () => {
      try {
        return await harvestSession(this.store, parsed, { imported, llm: this.llm });
      } finally {
        this.pending -= 1;
      }
    });
    this.chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }
}
