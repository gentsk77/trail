import { useEffect, useMemo, useState } from "react";
import { ConnectModal } from "./components/ConnectModal";
import { CreateObjectiveModal, CreateTaskModal } from "./components/CreateModal";
import { DemoNotice } from "./components/DemoNotice";
import { IconDefs } from "./components/Icons";
import { ObjectiveModal } from "./components/ObjectiveModal";
import { ProjectModal } from "./components/ProjectModal";
import { Sidebar, type ViewName } from "./components/Sidebar";
import { TaskModal } from "./components/TaskModal";
import { HttpClient } from "./lib/api";
import { AppState } from "./lib/appState";
import { DemoClient } from "./lib/demo/DemoClient";
import { Backlog } from "./views/Backlog";
import { Dashboard } from "./views/Dashboard";
import { Inbox } from "./views/Inbox";
import { Progress } from "./views/Progress";
import { Projects } from "./views/Projects";
import "./styles/app.css";

type ModalState =
  | { kind: "task"; id: string }
  | { kind: "objective"; id: string }
  | { kind: "new-task" }
  | { kind: "new-objective" }
  | { kind: "project"; id?: string } // absent id = create (D18)
  | { kind: "connect" }
  | null;

export function App() {
  /* D2: mode is a build flag; everything downstream of the client is
     identical between live-local and demo-seeded */
  const state = useMemo(
    () => new AppState(import.meta.env.MODE === "demo" ? new DemoClient() : new HttpClient()),
    []
  );
  const [view, setView] = useState<ViewName>("dashboard");
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => state.start(), [state]);

  const openTask = (id: string) => setModal({ kind: "task", id });
  const openObjective = (id: string) => setModal({ kind: "objective", id });
  const close = () => setModal(null);

  return (
    <>
      <IconDefs />
      <div className="shell">
        <Sidebar state={state} view={view} onNavigate={setView} onOpenConnect={() => setModal({ kind: "connect" })} />
        {view === "dashboard" && <Dashboard state={state} onOpenTask={openTask} />}
        {view === "inbox" && <Inbox state={state} />}
        {view === "backlog" && (
          <Backlog
            state={state}
            onOpenTask={openTask}
            onOpenObjective={openObjective}
            onNewTask={() => setModal({ kind: "new-task" })}
            onNewObjective={() => setModal({ kind: "new-objective" })}
          />
        )}
        {view === "projects" && (
          <Projects
            state={state}
            onOpenProject={(id) => setModal({ kind: "project", id })}
            onNewProject={() => setModal({ kind: "project" })}
            onOpenConnect={() => setModal({ kind: "connect" })}
          />
        )}
        {view === "progress" && <Progress state={state} onOpenTask={openTask} />}
      </div>
      {modal?.kind === "task" && (
        <TaskModal state={state} taskId={modal.id} onClose={close} onOpenObjective={openObjective} />
      )}
      {modal?.kind === "objective" && (
        <ObjectiveModal state={state} objectiveId={modal.id} onClose={close} onOpenTask={openTask} onOpenObjective={openObjective} />
      )}
      {modal?.kind === "new-task" && (
        <CreateTaskModal state={state} onClose={close} onCreated={openTask} />
      )}
      {modal?.kind === "new-objective" && (
        <CreateObjectiveModal state={state} onClose={close} />
      )}
      {modal?.kind === "project" && (
        <ProjectModal state={state} projectId={modal.id} onClose={close} />
      )}
      {modal?.kind === "connect" && (
        <ConnectModal state={state} onClose={close} />
      )}
      {/* the demo-notice toast (story 12): demo mode only, never live */}
      {state.client.mode === "demo" && <DemoNotice />}
    </>
  );
}
