import { useRef, useState } from "react";
import { BOARD_COLUMNS, STATUS_LABEL } from "../lib/status";
import type { Project, Status, Task } from "../lib/types";
import { Icon } from "./Icons";
import { ProjectPill, projectName } from "./ProjectPill";
import { Button } from "./ui/button";

/* The kanban: five columns minus Shelved; the column carries state, cards
   stay clean (title, project pill, nothing else). The whole column below
   the header is the drop target; manual moves are never blocked (D11). */

export function Board({ tasks, projects, onMove, onOpen, onQuickAdd }: {
  tasks: Task[];
  projects: Project[];
  onMove: (taskId: string, to: Status) => void;
  onOpen: (taskId: string) => void;
  onQuickAdd: (title: string) => void;
}) {
  const [dropCol, setDropCol] = useState<Status | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="board">
      {BOARD_COLUMNS.map((status) => {
        const cards = tasks.filter((t) => t.status === status);
        return (
          <div className="col" key={status}>
            <div className="col-head">
              <span className={`col-dot ${status}`} />
              {STATUS_LABEL[status]} <span className="count">{cards.length}</span>
              {status === "planned" && (
                <Button variant="quiet" size="icon" aria-label="Add task" onClick={() => setAdding(!adding)}>
                  <Icon name="plus" />
                </Button>
              )}
            </div>
            {status === "planned" && adding && (
              <QuickAdd
                onCreate={(title) => {
                  onQuickAdd(title);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            )}
            <div
              className={dropCol === status && dragging ? "col-body drop" : "col-body"}
              onDragOver={(e) => {
                e.preventDefault();
                setDropCol(status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/trail-task");
                setDropCol(null);
                setDragging(null);
                if (id) onMove(id, status);
              }}
            >
              {cards.map((task) => (
                <div
                  key={task.id}
                  className={dragging === task.id ? "task-card dragging" : "task-card"}
                  tabIndex={0}
                  title={task.title}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/trail-task", task.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(task.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropCol(null);
                  }}
                  onClick={() => onOpen(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(task.id);
                  }}
                >
                  <span className="title">{task.title}</span>
                  <span className="meta">
                    <ProjectPill name={projectName(projects, task.projectId)} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickAdd({ onCreate, onCancel }: { onCreate: (title: string) => void; onCancel: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const submit = () => {
    const title = input.current?.value.trim();
    if (title) onCreate(title);
    else onCancel();
  };
  return (
    <div className="quick-add">
      <input
        ref={input}
        type="text"
        placeholder="Task title"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button variant="primary" size="icon" aria-label="Create task" onClick={submit}>
        <Icon name="check" />
      </Button>
    </div>
  );
}
