import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icons";
import { Popover } from "../components/ui/popover";
import { ProjectPill, projectName } from "../components/ProjectPill";
import { StatusBadge } from "../components/StatusBadge";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { fmtShort } from "../lib/dates";
import { STATUSES } from "../lib/status";
import type { Objective, Status, Task } from "../lib/types";

/* The whole intent tree behind one GitHub-style list header (R1). Only
   Done counts as closed; the title is the click-open affordance; the
   checkbox is its own target — selected task rows morph the header into
   GitHub-style bulk controls (r1B.3). */

type Row =
  | { kind: "objective"; objective: Objective; level: 1 | 2 }
  | { kind: "task"; task: Task; level: number };

/* Filter key for tasks without a project ("No project" in the menu). */
const NO_PROJECT = "";

/* Filter predicate (ui r1): an empty set is no filter at all — every task
   passes; a non-empty set narrows to its members. Status and project
   intersect. Exported for tests. */
export function filterPass(
  t: Task,
  statusFilter: ReadonlySet<Status>,
  projectFilter: ReadonlySet<string>
): boolean {
  return (
    (statusFilter.size === 0 || statusFilter.has(t.status)) &&
    (projectFilter.size === 0 || projectFilter.has(t.projectId ?? NO_PROJECT))
  );
}

/* Sort by the semantic day the row displays — task.date, falling back to
   the createdAt day — never by raw createdAt: imported tasks share one
   import-burst minute, so createdAt order is arbitrary while the visible
   `when` column spans weeks (dogfood r1B §1). createdAt tiebreaks within
   a day; title keeps equal pairs stable. Direction flips day and
   tiebreak together so Newest/Oldest agree with the rendered column. */
export function taskCmp(sort: "newest" | "oldest") {
  const dir = sort === "newest" ? -1 : 1;
  return (a: Task, b: Task): number => {
    const dayA = a.date ?? a.createdAt.slice(0, 10);
    const dayB = b.date ?? b.createdAt.slice(0, 10);
    if (dayA !== dayB) return dir * dayA.localeCompare(dayB);
    if (a.createdAt !== b.createdAt) return dir * a.createdAt.localeCompare(b.createdAt);
    return a.title.localeCompare(b.title);
  };
}

/* Bulk selection semantics (r1B.3): the selection is only ever task rows
   the list currently renders — search, filters, and collapse all count as
   hiding, so a bulk edit can never touch a row the operator cannot see.
   Objective rows keep their own checkboxes but never join bulk ops; their
   ids pass through untouched. Returns the input set when nothing changed
   so state setters can skip the update. */
export function pruneSelection(
  checked: Set<string>,
  visibleTaskIds: ReadonlySet<string>,
  objectiveIds: ReadonlySet<string>
): Set<string> {
  const next = new Set([...checked].filter((id) => visibleTaskIds.has(id) || objectiveIds.has(id)));
  return next.size === checked.size ? checked : next;
}

/* Header select-all: an empty or mixed selection selects every visible
   task; only a full selection clears (indeterminate-click-selects, the
   GitHub convention). Non-task ids ride along untouched. */
export function toggleAllVisible(checked: ReadonlySet<string>, visibleTaskIds: ReadonlySet<string>): Set<string> {
  const next = new Set(checked);
  const all = [...visibleTaskIds].every((id) => next.has(id));
  for (const id of visibleTaskIds) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

/* What a bulk delete destroys, and what survives it (ui r3). An objective
   takes nothing down with it: tasks under it unassign and child objectives
   promote to the top level (the store's law). Rows already in the selection
   are not survivors — they die on their own account, so naming them again
   would double-count. Owns the confirm's two strings; exported for tests. */
const count = (n: number, one: string) => (n === 1 ? `1 ${one}` : `${n} ${one}s`);

export function deletePlan(
  selectedTaskIds: readonly string[],
  selectedObjectiveIds: readonly string[],
  tasks: readonly Task[],
  objectives: readonly Objective[]
): { summary: string; consequence: string } {
  const dying = new Set([...selectedTaskIds, ...selectedObjectiveIds]);
  const doomed = new Set(selectedObjectiveIds);
  const orphaned = tasks.filter((t) => t.objectiveId && doomed.has(t.objectiveId) && !dying.has(t.id)).length;
  const promoted = objectives.filter((o) => o.parentId && doomed.has(o.parentId) && !dying.has(o.id)).length;
  const summary = [
    selectedObjectiveIds.length ? count(selectedObjectiveIds.length, "objective") : null,
    selectedTaskIds.length ? count(selectedTaskIds.length, "task") : null
  ]
    .filter(Boolean)
    .join(" and ");
  const consequence =
    [
      orphaned > 0 ? `${count(orphaned, "task")} will stay in the backlog, unassigned.` : null,
      promoted > 0 ? `${count(promoted, "child objective")} will move to the top level.` : null
    ]
      .filter(Boolean)
      .join(" ") || "Nothing else will change.";
  return { summary, consequence };
}

export function Backlog({ state, onOpenTask, onOpenObjective, onNewTask, onNewObjective }: {
  state: AppState;
  onOpenTask: (id: string) => void;
  onOpenObjective: (id: string) => void;
  onNewTask: () => void;
  onNewObjective: () => void;
}) {
  const { tasks, objectives, projects } = useBootstrap(state);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<
    "new" | "status" | "project" | "sort" | "bulk-status" | "bulk-project" | "bulk-objective" | "bulk-delete" | null
  >(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const projectRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLButtonElement>(null);
  const bulkStatusRef = useRef<HTMLButtonElement>(null);
  const bulkProjectRef = useRef<HTMLButtonElement>(null);
  const bulkObjectiveRef = useRef<HTMLButtonElement>(null);
  const bulkDeleteRef = useRef<HTMLButtonElement>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /* filters start empty and empty means unfiltered (ui r1): checking a box
     narrows to the checked values; unchecking the last box restores the
     full list. Nothing-selected never means nothing-shown — which is why
     select-all retired (ui r3): checking every box showed the same list as
     checking none. Each menu now carries its own Clear as the last row,
     scoped to the one filter it undoes. */
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set());
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [query, setQuery] = useState("");

  /* projects referenced by at least one task, ordered by name — the
     filter and bulk menus stay scoped to what the list can show */
  const usedProjects = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.projectId).filter(Boolean));
    return projects.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, projects]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searching = q !== "";
    const out: Row[] = [];
    const byParent = (parentId?: string) =>
      objectives.filter((o) => (parentId ? o.parentId === parentId : o.level === 1));
    const cmp = taskCmp(sort);
    /* filters intersect: a task must pass status, project, and search */
    const matches = (t: Task) =>
      filterPass(t, statusFilter, projectFilter) &&
      (!searching || t.title.toLowerCase().includes(q));
    const visibleTasks = (objectiveId?: string) =>
      tasks.filter((t) => t.objectiveId === objectiveId && matches(t)).sort(cmp);

    /* While searching, empty branches prune away and collapse is ignored
       so every hit is visible; the stored collapse state returns intact
       when the query clears. Status/project filters alone keep the full
       objective skeleton, matching current behavior. */
    for (const l1 of byParent()) {
      const l1Tasks = visibleTasks(l1.id);
      const l2s = byParent(l1.id).map((o) => ({ objective: o, tasks: visibleTasks(o.id) }));
      if (searching && l1Tasks.length === 0 && l2s.every((x) => x.tasks.length === 0)) continue;
      out.push({ kind: "objective", objective: l1, level: 1 });
      if (!searching && collapsed.has(l1.id)) continue;
      for (const task of l1Tasks) out.push({ kind: "task", task, level: 1 });
      for (const { objective: l2, tasks: l2Tasks } of l2s) {
        if (searching && l2Tasks.length === 0) continue;
        out.push({ kind: "objective", objective: l2, level: 2 });
        if (!searching && collapsed.has(l2.id)) continue;
        for (const task of l2Tasks) out.push({ kind: "task", task, level: 2 });
      }
    }
    for (const task of visibleTasks(undefined)) out.push({ kind: "task", task, level: 0 });
    return out;
  }, [tasks, objectives, collapsed, statusFilter, projectFilter, query, sort]);

  const open = tasks.filter((t) => t.status !== "done").length;
  const closed = tasks.length - open;

  /* selection scope = the task rows actually rendered right now */
  const visibleTaskIds = useMemo(
    () => new Set(rows.flatMap((r) => (r.kind === "task" ? [r.task.id] : []))),
    [rows]
  );
  /* select-all sweeps every visible checkbox, objectives included (r1B.3
     nit); bulk writes still touch tasks alone — objectives have no status
     or project to write */
  const visibleRowIds = useMemo(
    () => new Set(rows.map((r) => (r.kind === "task" ? r.task.id : r.objective.id))),
    [rows]
  );
  const objectiveIds = useMemo(() => new Set(objectives.map((o) => o.id)), [objectives]);
  /* a filter, search, or collapse change prunes hidden tasks out of the
     selection — no invisible casualties of a later bulk edit; while a bulk
     loop runs the rows churn per write, so pruning waits for it to settle */
  useEffect(() => {
    if (bulkBusy) return;
    setChecked((prev) => pruneSelection(prev, visibleTaskIds, objectiveIds));
  }, [visibleTaskIds, objectiveIds, bulkBusy]);

  const selectedIds = useMemo(
    () => [...checked].filter((id) => visibleRowIds.has(id)),
    [checked, visibleRowIds]
  );
  const selectedTaskIds = useMemo(
    () => selectedIds.filter((id) => visibleTaskIds.has(id)),
    [selectedIds, visibleTaskIds]
  );
  /* objectives ride the selection and the counter, and Delete is the one
     bulk write that reaches them (ui r3) — the rest still touch tasks
     alone, since an objective carries no status or project */
  const selectedObjectiveIds = useMemo(
    () => selectedIds.filter((id) => objectiveIds.has(id)),
    [selectedIds, objectiveIds]
  );
  const plan = useMemo(
    () => deletePlan(selectedTaskIds, selectedObjectiveIds, tasks, objectives),
    [selectedTaskIds, selectedObjectiveIds, tasks, objectives]
  );
  const allSelected = visibleRowIds.size > 0 && selectedIds.length === visibleRowIds.size;
  const bulkMode = selectedIds.length > 0 || bulkBusy;
  /* crossing the morph boundary unmounts whichever cluster owned the open
     menu; reset so a stale key can't point at a gone anchor */
  useEffect(() => {
    setMenu(null);
  }, [bulkMode]);

  /* One bulk path: loop the same per-task endpoints the modal uses — no
     bulk route (out of scope). The store emits per write, so rows update
     while the loop runs. Selection survives an apply (GitHub keeps it
     after label-apply); tasks the edit pushes out of the current filters
     prune away once the loop settles. */
  const bulkApply = async (fn: (id: string) => Promise<unknown>, ids: string[] = selectedTaskIds) => {
    setMenu(null);
    setBulkBusy(true);
    try {
      for (const id of ids) await fn(id);
    } finally {
      /* a mid-loop failure must not skip the re-sync — rendered rows would
         silently diverge from the store */
      await state.refresh();
      setBulkBusy(false);
    }
  };

  /* the one bulk write that reaches objectives. Tasks lead so the store's
     unassign pass has fewer rows to walk once the objectives go — order is
     otherwise free, since deleting an objective only touches rows that
     survive it */
  const bulkDelete = () =>
    bulkApply(
      (id) => (objectiveIds.has(id) ? state.client.deleteObjective(id) : state.client.deleteTask(id)),
      [...selectedTaskIds, ...selectedObjectiveIds]
    );

  /* L1 objectives with their L2s beneath, for the bulk objective menu */
  const objectiveTree = useMemo(
    () =>
      objectives
        .filter((o) => o.level === 1)
        .map((l1) => ({ l1, l2s: objectives.filter((o) => o.parentId === l1.id) })),
    [objectives]
  );

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };
  const toggleCheck = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };
  const toggleStatus = (s: Status) => {
    const next = new Set(statusFilter);
    next.has(s) ? next.delete(s) : next.add(s);
    setStatusFilter(next);
  };
  const projectChecked = (key: string) => projectFilter.has(key);
  const toggleProject = (key: string) => {
    const next = new Set(projectFilter);
    next.has(key) ? next.delete(key) : next.add(key);
    setProjectFilter(next);
  };
  /* content indent: 16 per level over the caret slot (10 + 8) every task
     shares — an unassigned task aligns with the objectives, not left of
     them (r1B.3 nit); checkboxes stay flush left */
  const titleIndent = (level: number) => ({ marginLeft: level * 16 + 10 + 8 });

  return (
    <div className="content">
      <div className="view-head">
        <h3>Backlog</h3>
        <span className="side">
          <button type="button" ref={newRef} className="btn btn-primary btn-small picker" onClick={() => setMenu(menu === "new" ? null : "new")}>
            <Icon name="plus" />New
            <svg className="icon" style={{ width: 10, height: 10 }} aria-hidden="true"><use href="#i-caret" /></svg>
          </button>
          {menu === "new" && (
            <Popover anchorRef={newRef} align="end" onClose={() => setMenu(null)}><div className="menu">
              <button type="button" className="menu-item" onClick={() => { setMenu(null); onNewTask(); }}>New task</button>
              <button type="button" className="menu-item" onClick={() => { setMenu(null); onNewObjective(); }}>New objective</button>
            </div></Popover>
          )}
        </span>
      </div>
      <div className="list-search">
        <Icon name="search" />
        <input
          type="text"
          placeholder="Search tasks"
          aria-label="Search tasks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tree">
        <div className="list-head">
          <Cbx
            checked={allSelected}
            mixed={selectedIds.length > 0 && !allSelected}
            ariaLabel="Select all tasks"
            onToggle={() => setChecked(toggleAllVisible(checked, visibleRowIds))}
          />
          {bulkMode ? (
            <>
              <span className="counts">
                <span className="on">{selectedIds.length} of {visibleRowIds.size} selected</span>
              </span>
              {/* bulk controls: icon + action verb, caret-free — the verbs
                  say these write, unlike the filter cluster (r1B.3 nit) */}
              <span className="side" aria-busy={bulkBusy}>
                <span>
                  <button type="button" ref={bulkStatusRef} className="btn btn-quiet btn-small picker" disabled={bulkBusy} onClick={() => setMenu(menu === "bulk-status" ? null : "bulk-status")}>
                    <Icon name="check" />Mark as
                  </button>
                  {menu === "bulk-status" && (
                    <Popover anchorRef={bulkStatusRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      {STATUSES.map((s) => (
                        <button key={s} type="button" className="menu-item" onClick={() => void bulkApply((id) => state.client.moveStatus(id, s))}>
                          <StatusBadge status={s} />
                        </button>
                      ))}
                    </div></Popover>
                  )}
                </span>
                <span>
                  <button type="button" ref={bulkProjectRef} className="btn btn-quiet btn-small picker" disabled={bulkBusy} onClick={() => setMenu(menu === "bulk-project" ? null : "bulk-project")}>
                    <Icon name="arrow" />Move to
                  </button>
                  {menu === "bulk-project" && (
                    <Popover anchorRef={bulkProjectRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      {usedProjects.map((p) => (
                        /* one name per row, full directory on hover (r5.2) */
                        <button key={p.id} type="button" className="menu-item" title={p.dir ?? p.name} onClick={() => void bulkApply((id) => state.client.updateTask(id, { projectId: p.id }))}>
                          <Icon name="folder" />
                          <span className="proj-lbl">{p.name}</span>
                        </button>
                      ))}
                      <button type="button" className="menu-item sep-above" onClick={() => void bulkApply((id) => state.client.updateTask(id, { projectId: undefined }))}>None</button>
                    </div></Popover>
                  )}
                </span>
                <span>
                  <button type="button" ref={bulkObjectiveRef} className="btn btn-quiet btn-small picker" disabled={bulkBusy} onClick={() => setMenu(menu === "bulk-objective" ? null : "bulk-objective")}>
                    <Icon name="flag" />Set objective
                  </button>
                  {menu === "bulk-objective" && (
                    <Popover anchorRef={bulkObjectiveRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      {objectiveTree.map(({ l1, l2s }) => (
                        <span key={l1.id} style={{ display: "contents" }}>
                          <button type="button" className="menu-item" title={l1.title} onClick={() => void bulkApply((id) => state.client.updateTask(id, { objectiveId: l1.id }))}>
                            <span className="obj-lbl">{l1.title}</span>
                          </button>
                          {l2s.map((l2) => (
                            <button key={l2.id} type="button" className="menu-item sub" title={l2.title} onClick={() => void bulkApply((id) => state.client.updateTask(id, { objectiveId: l2.id }))}>
                              <span className="obj-lbl">{l2.title}</span>
                            </button>
                          ))}
                        </span>
                      ))}
                      <button type="button" className="menu-item sep-above" onClick={() => void bulkApply((id) => state.client.updateTask(id, { objectiveId: undefined }))}>None</button>
                    </div></Popover>
                  )}
                </span>
                <span>
                  <button type="button" ref={bulkDeleteRef} className="btn btn-quiet btn-small picker" disabled={bulkBusy} onClick={() => setMenu(menu === "bulk-delete" ? null : "bulk-delete")}>
                    <Icon name="trash" />Delete
                  </button>
                  {menu === "bulk-delete" && (
                    <Popover anchorRef={bulkDeleteRef} align="end" onClose={() => setMenu(null)}>
                      {selectedObjectiveIds.length === 0 ? (
                        /* tasks take nothing down with them, so the menu is
                           the confirmation: one deliberate second click that
                           names the count — no dialog */
                        <div className="menu">
                          <button type="button" className="menu-item" onClick={() => void bulkDelete()}>
                            <Icon name="trash" />Delete {plan.summary}
                          </button>
                        </div>
                      ) : (
                        /* an objective in the selection has rows under it, so
                           the confirm rides the mini-dialog chrome and says
                           what becomes of them (the deleteProject law) */
                        <div className="menu note">
                          <h4>Delete {plan.summary}?</h4>
                          <p>{plan.consequence}</p>
                          <div className="foot">
                            <button type="button" className="btn btn-secondary btn-small" onClick={() => setMenu(null)}>Cancel</button>
                            <button type="button" className="btn btn-primary btn-small" onClick={() => void bulkDelete()}>Delete</button>
                          </div>
                        </div>
                      )}
                    </Popover>
                  )}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="counts">
                <span className="on">{open} open</span>
                <span className="off">{closed} closed</span>
              </span>
              <span className="side">
                <span>
                  <button type="button" ref={statusRef} className="btn btn-quiet btn-small picker" onClick={() => setMenu(menu === "status" ? null : "status")}>
                    <Icon name="status" />Status
                  </button>
                  {menu === "status" && (
                    <Popover anchorRef={statusRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      {STATUSES.map((s) => (
                        <button key={s} type="button" className="menu-item" onClick={() => toggleStatus(s)}>
                          <span className={statusFilter.has(s) ? "cbx checked" : "cbx"}>
                            {statusFilter.has(s) && <Icon name="check" />}
                          </span>
                          <StatusBadge status={s} />
                        </button>
                      ))}
                      {statusFilter.size > 0 && (
                        <button type="button" className="menu-item sep-above" onClick={() => setStatusFilter(new Set())}>
                          <Icon name="x" />Clear
                        </button>
                      )}
                    </div></Popover>
                  )}
                </span>
                <span>
                  <button type="button" ref={projectRef} className="btn btn-quiet btn-small picker" onClick={() => setMenu(menu === "project" ? null : "project")}>
                    <Icon name="folder" />Project
                  </button>
                  {menu === "project" && (
                    <Popover anchorRef={projectRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      {usedProjects.map((p) => (
                        <button key={p.id} type="button" className="menu-item" title={p.dir ?? p.name} onClick={() => toggleProject(p.id)}>
                          <span className={projectChecked(p.id) ? "cbx checked" : "cbx"}>
                            {projectChecked(p.id) && <Icon name="check" />}
                          </span>
                          <Icon name="folder" />
                          <span className="proj-lbl">{p.name}</span>
                        </button>
                      ))}
                      <button type="button" className="menu-item" onClick={() => toggleProject(NO_PROJECT)}>
                        <span className={projectChecked(NO_PROJECT) ? "cbx checked" : "cbx"}>
                          {projectChecked(NO_PROJECT) && <Icon name="check" />}
                        </span>
                        No project
                      </button>
                      {projectFilter.size > 0 && (
                        <button type="button" className="menu-item sep-above" onClick={() => setProjectFilter(new Set())}>
                          <Icon name="x" />Clear
                        </button>
                      )}
                    </div></Popover>
                  )}
                </span>
                <span>
                  <button type="button" ref={sortRef} className="btn btn-quiet btn-small picker" onClick={() => setMenu(menu === "sort" ? null : "sort")}>
                    <Icon name="sort" />Sort
                  </button>
                  {menu === "sort" && (
                    <Popover anchorRef={sortRef} align="end" onClose={() => setMenu(null)}><div className="menu">
                      <button type="button" className="menu-item" onClick={() => { setSort("newest"); setMenu(null); }}>
                        {sort === "newest" ? <Icon name="check" /> : <span style={{ width: 12, flex: "none" }} />}Newest first
                      </button>
                      <button type="button" className="menu-item" onClick={() => { setSort("oldest"); setMenu(null); }}>
                        {sort === "oldest" ? <Icon name="check" /> : <span style={{ width: 12, flex: "none" }} />}Oldest first
                      </button>
                    </div></Popover>
                  )}
                </span>
              </span>
            </>
          )}
        </div>
        {rows.map((row) =>
          row.kind === "objective" ? (
            <button
              key={row.objective.id}
              type="button"
              className={`tree-row obj-${row.level}${collapsed.has(row.objective.id) ? " collapsed" : ""}`}
              onClick={() => onOpenObjective(row.objective.id)}
            >
              <Cbx checked={checked.has(row.objective.id)} onToggle={() => toggleCheck(row.objective.id)} />
              <svg
                className="icon caret"
                style={row.level === 2 ? { marginLeft: 16 } : undefined}
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(row.objective.id);
                }}
              >
                <use href="#i-caret" />
              </svg>
              <span className="title">{row.objective.title}</span>
            </button>
          ) : (
            <button key={row.task.id} type="button" className="tree-row task" onClick={() => onOpenTask(row.task.id)}>
              <Cbx checked={checked.has(row.task.id)} onToggle={() => toggleCheck(row.task.id)} />
              <span className="title" style={titleIndent(row.level)}>{row.task.title}</span>
              <ProjectPill name={projectName(projects, row.task.projectId)} />
              <StatusBadge status={row.task.status} />
              {row.task.status !== "shelved" && row.task.date && <span className="when">{fmtShort(row.task.date)}</span>}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Cbx({ checked, mixed = false, ariaLabel, onToggle }: {
  checked: boolean;
  mixed?: boolean; /* header select-all only: some-but-not-all visible tasks */
  ariaLabel?: string;
  onToggle: () => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={ariaLabel}
      tabIndex={0}
      className={checked ? "cbx checked" : mixed ? "cbx mixed" : "cbx"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      {checked ? <Icon name="check" /> : mixed ? <span className="dash" /> : null}
    </span>
  );
}
