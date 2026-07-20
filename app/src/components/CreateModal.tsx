import type { AppState } from "../lib/appState";
import { ObjectiveModal } from "./ObjectiveModal";
import { TaskModal } from "./TaskModal";

/* Creation reuses the detail modals wholesale (r1B.2 item 6; objectives
   joined at dogfood r3): same anatomy, fields stage into a draft, footer
   Cancel + Create. */

export function CreateTaskModal({ state, objectiveId, onClose, onCreated }: {
  state: AppState;
  objectiveId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  return <TaskModal state={state} mode="create" objectiveId={objectiveId} onClose={onClose} onCreated={onCreated} />;
}

export function CreateObjectiveModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  return <ObjectiveModal state={state} onClose={onClose} />;
}
