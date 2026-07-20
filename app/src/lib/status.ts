/* The one source module for status strings and rules (design law: no view
   invents status strings; D8/D11: automation never sets Done). */

import type { Actor, Status } from "./types";

export const STATUSES: readonly Status[] = [
  "planned", "running", "waiting", "ready", "done", "shelved"
];

export const STATUS_LABEL: Record<Status, string> = {
  planned: "Planned",
  running: "Running",
  waiting: "Waiting",
  ready: "Ready",
  done: "Done",
  shelved: "Shelved"
};

/* Board shows five lanes minus Shelved (D9). */
export const BOARD_COLUMNS: readonly Status[] = [
  "planned", "running", "waiting", "ready", "done"
];

/* Manual moves are never blocked (D11); automation stops at Ready. */
export function canSetStatus(by: Actor, to: Status): boolean {
  return by === "operator" || to !== "done";
}
