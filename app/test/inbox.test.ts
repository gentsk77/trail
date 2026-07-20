import { describe, expect, it } from "vitest";
import { composeInbox } from "../src/lib/inbox";
import type { Artifact, SessionRecord, Task } from "../src/lib/types";

/* The attention queue (D17): Ready oldest-Ready first, Waiting oldest
   first, ordered on statusAt — never updatedAt, which field edits move. */

const task = (patch: Partial<Task> & { id: string; status: Task["status"] }): Task => ({
  title: patch.id,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  linkedSessionIds: [],
  ...patch
});

const session = (patch: Partial<SessionRecord> & { id: string }): SessionRecord => ({
  projectDir: "D:/x",
  storeDir: "d",
  file: `${patch.id}.jsonl`,
  startedAt: "2026-07-01T00:00:00Z",
  lastActiveAt: "2026-07-01T01:00:00Z",
  liveStatus: "waiting",
  suggestions: [],
  harvestState: "heuristic",
  imported: true,
  ...patch
});

describe("inbox composition (D17)", () => {
  it("orders sign-off by statusAt oldest first, ignoring updatedAt edits", () => {
    const tasks = [
      task({ id: "young", status: "ready", statusAt: "2026-07-15T10:00:00Z", updatedAt: "2026-07-15T10:00:00Z" }),
      /* edited five minutes ago — updatedAt is new, its Ready is old */
      task({ id: "old", status: "ready", statusAt: "2026-07-14T08:00:00Z", updatedAt: "2026-07-15T12:00:00Z" }),
      task({ id: "not-ready", status: "running" })
    ];
    const { signoff } = composeInbox(tasks, [], () => []);
    expect(signoff.map((c) => c.task.id)).toEqual(["old", "young"]);
  });

  it("falls back to updatedAt for pre-migration tasks without statusAt", () => {
    const tasks = [
      task({ id: "b", status: "waiting", updatedAt: "2026-07-15T09:00:00Z" }),
      task({ id: "a", status: "waiting", updatedAt: "2026-07-14T09:00:00Z" })
    ];
    const { waiting } = composeInbox(tasks, [], () => []);
    expect(waiting.map((c) => c.task.id)).toEqual(["a", "b"]);
  });

  it("carries artifacts per sign-off card and the last agent message from the freshest linked session", () => {
    const art: Artifact = { kind: "commit", label: "abc1234", sessionId: "s1", at: "2026-07-15T00:00:00Z" };
    const tasks = [
      task({ id: "r1", status: "ready", linkedSessionIds: ["s1"] }),
      task({ id: "w1", status: "waiting", linkedSessionIds: ["s-old", "s-new"] })
    ];
    const sessions = [
      session({ id: "s1" }),
      session({ id: "s-old", lastActiveAt: "2026-07-14T00:00:00Z", lastAgentMessage: "stale question" }),
      session({ id: "s-new", lastActiveAt: "2026-07-15T00:00:00Z", lastAgentMessage: "which number ships?" })
    ];
    const { signoff, waiting } = composeInbox(tasks, sessions, (id) => (id === "r1" ? [art] : []));
    expect(signoff[0].artifacts).toEqual([art]);
    expect(signoff[0].sessionId).toBe("s1");
    expect(waiting[0].lastMessage).toBe("which number ships?");
    expect(waiting[0].sessionId).toBe("s-new");
  });

  it("sign-off cards carry the agent's last message — the artifact-less card's fallback evidence (D25)", () => {
    const tasks = [task({ id: "r-bare", status: "ready", linkedSessionIds: ["s-claim"] })];
    const sessions = [session({ id: "s-claim", lastAgentMessage: "All clean — merged the fix." })];
    const { signoff } = composeInbox(tasks, sessions, () => []);
    expect(signoff[0].artifacts).toEqual([]);
    expect(signoff[0].lastMessage).toBe("All clean — merged the fix.");
  });

  it("renders emptiness honestly: both sections empty when nothing needs the operator", () => {
    const { signoff, waiting } = composeInbox([task({ id: "t", status: "done" })], [], () => []);
    expect(signoff).toEqual([]);
    expect(waiting).toEqual([]);
  });
});
