import { useState } from "react";
import { Board } from "../components/Board";
import { CalendarControl, type CalMode } from "../components/CalendarControl";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { inWeek, today } from "../lib/dates";
import type { Status } from "../lib/types";

/* The Dashboard is the board (D9): time scope lives in the calendar
   cluster, Today default with the Week toggle. */

export function Dashboard({ state, onOpenTask }: { state: AppState; onOpenTask: (id: string) => void }) {
  const { tasks, projects } = useBootstrap(state);
  const [mode, setMode] = useState<CalMode>("day");
  const [anchor, setAnchor] = useState(today());

  const scoped = tasks.filter((t) => {
    if (t.status === "shelved" || !t.date) return false;
    return mode === "day" ? t.date === anchor : inWeek(t.date, anchor);
  });

  const move = (taskId: string, to: Status) => {
    void state.client.moveStatus(taskId, to).then(() => state.refresh());
  };

  const quickAdd = (title: string) => {
    void state.client.createTask({ title, date: anchor }).then(() => state.refresh());
  };

  return (
    <div className="content content-fill">
      <div className="view-head">
        <h3>Dashboard</h3>
        <div className="side">
          <CalendarControl mode={mode} anchor={anchor} onMode={setMode} onAnchor={setAnchor} />
        </div>
      </div>
      <Board tasks={scoped} projects={projects} onMove={move} onOpen={onOpenTask} onQuickAdd={quickAdd} />
    </div>
  );
}
