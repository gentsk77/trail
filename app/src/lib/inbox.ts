import type { Artifact, SessionRecord, Task } from "./types";

/* Inbox composition (D17): the attention queue, one shape for both
   clients — the sidecar's /api/inbox and the demo client build it from
   their own stores through this one function.

   Needs sign-off = Ready tasks, oldest-Ready first; Waiting on you =
   Waiting tasks, oldest first. Age lives in the ordering (r3: no
   since-stamps), keyed on statusAt — updatedAt moves on field edits and
   cannot carry a queue. Each card points at the task's most recently
   active linked session (Open session, and the waiting card's message). */

export interface InboxSignoffCard {
  task: Task;
  artifacts: Artifact[];
  /* the agent's claim — the expanded card's fallback evidence when the
     artifact strip is empty (D25) */
  lastMessage?: string;
  sessionId?: string;
}

export interface InboxWaitingCard {
  task: Task;
  lastMessage?: string;
  sessionId?: string;
}

export interface InboxResult {
  signoff: InboxSignoffCard[];
  waiting: InboxWaitingCard[];
}

const enteredAt = (t: Task) => t.statusAt ?? t.updatedAt;
const oldestFirst = (a: Task, b: Task) => enteredAt(a).localeCompare(enteredAt(b));

export function composeInbox(
  tasks: Task[],
  sessions: SessionRecord[],
  artifactsFor: (taskId: string) => Artifact[]
): InboxResult {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const latestSession = (task: Task): SessionRecord | undefined =>
    task.linkedSessionIds
      .map((id) => byId.get(id))
      .filter((s): s is SessionRecord => !!s)
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))[0];

  const signoff = tasks
    .filter((t) => t.status === "ready")
    .sort(oldestFirst)
    .map((task) => {
      const session = latestSession(task);
      return { task, artifacts: artifactsFor(task.id), lastMessage: session?.lastAgentMessage, sessionId: session?.id };
    });

  const waiting = tasks
    .filter((t) => t.status === "waiting")
    .sort(oldestFirst)
    .map((task) => {
      const session = latestSession(task);
      return { task, lastMessage: session?.lastAgentMessage, sessionId: session?.id };
    });

  return { signoff, waiting };
}
