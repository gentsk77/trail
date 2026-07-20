import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Task } from "../../src/lib/types";
import type { ParsedSession } from "../adapters/sessions/types";

const execFileAsync = promisify(execFile);

/* Language pass (R5b) over a compacted digest via headless `claude -p`.
   Emits claims / friction / lessons (the D6 substrate) and link
   suggestions with confidence. Callers degrade to heuristic-only when
   this throws — the harvester never blocks on the LLM. */

export interface LlmHarvest {
  claims: { text: string }[];
  friction: string[];
  lessons: string[];
  links: { taskId: string; confidence: number; reason?: string }[];
}

export type TaskDirResolver = (task: Task) => string | undefined;
export type LlmExtractor = (parsed: ParsedSession, openTasks: Task[], dirOf: TaskDirResolver) => Promise<LlmHarvest>;

export function buildDigest(parsed: ParsedSession, openTasks: Task[], dirOf: TaskDirResolver): string {
  const prompts = parsed.userPrompts.slice(0, 8).map((p) => `- ${p.text.slice(0, 200)}`).join("\n");
  const commits = parsed.commits.map((c) => `- ${c.sha} ${c.subject ?? ""}`).join("\n") || "(none)";
  const files = [...new Set(parsed.fileRefs.map((f) => f.path))].slice(0, 20).join("\n") || "(none)";
  const tasks = openTasks
    .map((t) => {
      const dir = dirOf(t);
      return `- id=${t.id} | ${t.title}${dir ? ` | dir=${dir}` : ""}`;
    })
    .join("\n") || "(none)";
  return `SESSION DIGEST
directory: ${parsed.projectDir}
title: ${parsed.title ?? "(none)"}
first prompt: ${parsed.firstPrompt?.slice(0, 400) ?? "(none)"}
user prompts (sample):
${prompts || "(none)"}
commits:
${commits}
files touched:
${files}
final assistant message (truncated):
${parsed.lastAssistantText?.slice(0, 800) ?? "(none)"}

OPEN TASKS (candidates for linking):
${tasks}`;
}

const INSTRUCTIONS = `You are an evidence harvester for a task tracker. Read the session digest and answer with STRICT JSON only (no prose, no code fences), shaped exactly:
{"claims":[{"text":"..."}],"friction":["..."],"lessons":["..."],"links":[{"taskId":"...","confidence":0.0,"reason":"..."}]}

- claims: outcomes the session actually claims to have finished (empty if none). Quote or closely paraphrase; never invent.
- friction: concrete points where the work stalled, was repeated, or needed manual correction (empty if none).
- lessons: candidate procedure improvements a future session could reuse (empty if none).
- links: which OPEN TASKS this session's work plausibly belongs to; confidence 0..1, honest. Only listed task ids. Empty if none fit.`;

export async function runClaudeJson(prompt: string, timeoutMs = 180_000): Promise<string> {
  const model = process.env.TRAIL_HARVEST_MODEL ?? "haiku";
  const { stdout } = await execFileAsync(
    "claude",
    ["-p", prompt, "--output-format", "json", "--model", model],
    { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, windowsHide: true }
  );
  const wrapper = JSON.parse(stdout);
  if (typeof wrapper.result !== "string") throw new Error("claude -p: no result field");
  return wrapper.result;
}

function parseStrictJson(text: string): LlmHarvest {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in LLM output");
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  return {
    claims: Array.isArray(parsed.claims) ? parsed.claims.filter((c: any) => typeof c?.text === "string") : [],
    friction: Array.isArray(parsed.friction) ? parsed.friction.filter((f: any) => typeof f === "string") : [],
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons.filter((l: any) => typeof l === "string") : [],
    links: Array.isArray(parsed.links)
      ? parsed.links
          .filter((l: any) => typeof l?.taskId === "string" && typeof l?.confidence === "number")
          .map((l: any) => ({ taskId: l.taskId, confidence: Math.max(0, Math.min(1, l.confidence)), reason: l.reason }))
      : []
  };
}

export const claudeExtractor: LlmExtractor = async (parsed, openTasks, dirOf) => {
  const prompt = `${INSTRUCTIONS}\n\n${buildDigest(parsed, openTasks, dirOf)}`;
  try {
    return parseStrictJson(await runClaudeJson(prompt));
  } catch {
    // one retry, then the caller degrades to heuristic-only
    return parseStrictJson(await runClaudeJson(prompt));
  }
};
