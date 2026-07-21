import { STATUS_LABEL } from "../lib/status";
import type { Status } from "../lib/types";
import { Badge } from "./ui/badge";

/* Badges are pills with a dot and a sentence-case word (status grammar);
   labels come from the one source module, never a view. Rendering rides
   the ui/badge component (D31). */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={status}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
