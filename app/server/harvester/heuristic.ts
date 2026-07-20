import path from "node:path";
import type { EvidenceEvent, LinkSuggestion, Task } from "../../src/lib/types";
import type { ParsedSession } from "../adapters/sessions/types";

/* Heuristic harvest (R5a): deterministic extraction with source pointers.
   Dispatched sessions link by marker — no matching (D5). Everything else
   only ever becomes a pending suggestion; the harvester never silently
   promotes a link or a verdict. */

const CLAIM = /\b(done|shipped|completed|fixed|merged|landed|deployed|implemented)\b/i;

type NewEvidence = Omit<EvidenceEvent, "id">;

export function evidenceFrom(parsed: ParsedSession, gen: string): NewEvidence[] {
  const src = (line: number) => ({ file: parsed.file, line });
  const at = parsed.lastActiveAt;
  const events: NewEvidence[] = [];

  if (parsed.firstPrompt) {
    events.push({ sessionId: parsed.id, kind: "first-prompt", payload: { text: parsed.firstPrompt.slice(0, 500) }, source: src(1), gen, at });
  }
  if (parsed.title) {
    events.push({ sessionId: parsed.id, kind: "title", payload: { text: parsed.title }, source: src(1), gen, at });
  }
  for (const ref of parsed.fileRefs) {
    events.push({ sessionId: parsed.id, kind: "file-ref", payload: { path: ref.path, tool: ref.tool }, source: src(ref.line), gen, at });
  }
  for (const commit of parsed.commits) {
    events.push({ sessionId: parsed.id, kind: "commit-ref", payload: { sha: commit.sha, subject: commit.subject }, source: src(commit.line), gen, at });
  }
  for (const pr of parsed.prLinks) {
    events.push({ sessionId: parsed.id, kind: "pr-ref", payload: { url: pr.url, label: pr.number ? `#${pr.number}` : pr.url }, source: src(pr.line), gen, at });
  }
  /* one segment per session: the openable pointer into the transcript */
  events.push({
    sessionId: parsed.id, kind: "segment",
    payload: { label: parsed.title ?? parsed.firstPrompt?.slice(0, 60) ?? parsed.id.slice(0, 8), file: parsed.file },
    source: src(1), gen, at
  });
  /* crude claim detection; the language pass (R5b) refines this */
  if (parsed.lastAssistantText && CLAIM.test(parsed.lastAssistantText)) {
    events.push({
      sessionId: parsed.id, kind: "outcome-claim",
      payload: { text: parsed.lastAssistantText.slice(0, 300), via: "heuristic" },
      source: src(parsed.eventCount), gen, at
    });
  }
  return events;
}

/* Fallback link suggestions when no LLM pass runs: same working directory
   plus token overlap between the session's words and the task title.
   dirOf resolves a task's project to its directory (projects are
   first-class, D18 — tasks no longer carry the dir themselves). */
export function suggestLinks(parsed: ParsedSession, tasks: Task[], dirOf: (task: Task) => string | undefined): LinkSuggestion[] {
  const text = `${parsed.title ?? ""} ${parsed.firstPrompt ?? ""}`.toLowerCase();
  const words = new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const out: LinkSuggestion[] = [];
  for (const task of tasks) {
    if (task.status === "done" || task.status === "shelved") continue;
    const titleWords = task.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    if (titleWords.length === 0) continue;
    const hit = titleWords.filter((w) => words.has(w)).length / titleWords.length;
    const taskDir = dirOf(task);
    const sameDir = !!taskDir && !!parsed.projectDir &&
      path.resolve(taskDir).toLowerCase() === path.resolve(parsed.projectDir).toLowerCase();
    const confidence = Math.min(0.75, hit * 0.6 + (sameDir ? 0.25 : 0));
    if (confidence >= 0.3) {
      out.push({ taskId: task.id, confidence: Number(confidence.toFixed(2)), reason: "heuristic: title overlap" + (sameDir ? " + same directory" : ""), state: "pending" });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
