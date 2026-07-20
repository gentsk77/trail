import { STATUS_LABEL } from "../lib/status";
import type { Status } from "../lib/types";

/* Badges are pills with a dot and a sentence-case word (status grammar);
   labels come from the one source module, never a view. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}
