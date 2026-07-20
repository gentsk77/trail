import { useState } from "react";
import { Icon } from "../components/Icons";
import { Popover } from "../components/Popover";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";

/* Projects, the management surface (D18): a card grid and a New project
   action. A project is first-class — editable name, optional working
   directory — so folderless projects (errands, plans) sit beside
   connected repos. Cards are clean (r2): name, middle-truncated mono
   path, task count, nothing else; the absent path line is what "no
   folder" looks like. The session lists this view used to carry retired;
   pending link suggestions surface in the task modal.

   The card corner carries an overflow menu (ui r2): Edit opens the same
   modal the card click does; Delete confirms in the menu itself, naming
   what happens to the project's tasks — they unassign, never die. */

type CardMenu = { id: string; el: HTMLElement; confirm: boolean };

export function Projects({ state, onOpenProject, onNewProject, onOpenConnect }: {
  state: AppState;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onOpenConnect: () => void;
}) {
  const { projects, tasks } = useBootstrap(state);
  const [menu, setMenu] = useState<CardMenu | null>(null);
  const [busy, setBusy] = useState(false);
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  const countOf = (id: string) => tasks.filter((t) => t.projectId === id).length;

  const toggleMenu = (id: string, el: HTMLElement) => {
    setMenu(menu?.id === id ? null : { id, el, confirm: false });
  };

  const deleteProject = async (id: string) => {
    setMenu(null);
    setBusy(true);
    try {
      await state.client.deleteProject(id);
    } finally {
      await state.refresh();
      setBusy(false);
    }
  };

  return (
    <div className="content">
      <div className="view-head">
        <h3>Projects</h3>
        <span className="side">
          <button type="button" className="btn btn-primary btn-small" onClick={onNewProject}>
            <Icon name="plus" />New project
          </button>
        </span>
      </div>
      {projects.length === 0 ? (
        <div className="empty-state">
          <span className="lede">No projects yet</span>
          <span className="why">Connect to agents and Trail imports their projects and sessions.</span>
          <button type="button" className="btn btn-secondary" onClick={onOpenConnect}>Connect to agents</button>
        </div>
      ) : (
        <div className="proj-grid">
          {sorted.map((project) => {
            const n = countOf(project.id);
            return (
              <button key={project.id} type="button" className="proj-card" onClick={() => onOpenProject(project.id)}>
                <span className="name">{project.name}</span>
                {/* the kebab is its own target inside the card button, the
                    tree-row checkbox pattern */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Project actions: ${project.name}`}
                  aria-haspopup="menu"
                  className="proj-kebab"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu(project.id, e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleMenu(project.id, e.currentTarget);
                    }
                  }}
                >
                  <Icon name="more" />
                </span>
                {project.dir && <span className="path" title={project.dir}>{project.dir}</span>}
                <span className="count">{n === 1 ? "1 task" : `${n} tasks`}</span>
              </button>
            );
          })}
        </div>
      )}
      {menu && !menu.confirm && (
        <Popover anchorRef={{ current: menu.el }} align="end" onClose={() => setMenu(null)}>
          <div className="menu">
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenu(null);
                onOpenProject(menu.id);
              }}
            >
              <Icon name="pencil" />
              Edit project
            </button>
            <button type="button" className="menu-item" disabled={busy} onClick={() => setMenu({ ...menu, confirm: true })}>
              <Icon name="trash" />
              Delete project
            </button>
          </div>
        </Popover>
      )}
      {menu && menu.confirm && (
        /* the confirm rides the mini-dialog chrome (the demo note's, ui
           r2): title, one paragraph naming the consequence, Cancel and
           the act. Tasks unassign, they never die. */
        <Popover anchorRef={{ current: menu.el }} align="end" onClose={() => setMenu(null)}>
          <div className="menu note">
            <h4>Delete {projects.find((p) => p.id === menu.id)?.name ?? "this project"}?</h4>
            <p>
              {countOf(menu.id) === 0
                ? "Only the project will be deleted. It has no tasks."
                : countOf(menu.id) === 1
                  ? "Only the project will be deleted. 1 task will stay in the backlog, unassigned."
                  : `Only the project will be deleted. ${countOf(menu.id)} tasks will stay in the backlog, unassigned.`}
            </p>
            <div className="foot">
              <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => setMenu(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void deleteProject(menu.id)}>Delete</button>
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
}
