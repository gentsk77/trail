import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskDetail } from "../lib/api";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { fmtShort, fmtTs } from "../lib/dates";
import { STATUSES, STATUS_LABEL } from "../lib/status";
import type { Objective, Status } from "../lib/types";
import { artifactIcon } from "./ArtifactTile";
import { Icon, type IconName } from "./Icons";
import { ModalWrap } from "./Modal";
import { Popover } from "./Popover";
import { ProjectPill, projectName } from "./ProjectPill";
import { StatusBadge } from "./StatusBadge";
import { CalendarPopoverField } from "./CalendarField";

/* Task detail (GitHub-issues split): main column tells the story, the side
   rail holds the fields; artifacts live here and nowhere else (D8). Every
   state stays open to the operator (D11), but inside this modal the status
   pick stages like any other field and lands on Save (dogfood r4,
   completing the r1B.3 Save gate — board drags stay immediate; Save fires
   moveStatus so the move still logs as a move).

   Every other field stages locally (r1B.3 item 2, partially reversing the
   r1B inline-commit cut): text still edits in place — click the text,
   Enter/blur closes the field, Escape reverts it — and the side-rail
   pickers still pick, but title/description/objective/project/date land
   in a dirty map and persist only through the footer's Save, one
   updateTask carrying every dirty field. Close discards staged edits
   silently (the pre-r1B behavior). The crumb chain renders the persisted
   objective, so it moves on Save, not on selection.

   The create variant (r1B.2 item 6) reuses this exact anatomy for "New
   task": the same inline edits and side-rail pickers write to a local
   draft instead of the store, Activity and Artifacts (which need a
   persisted task) stay out, and the footer is Cancel + Create — one
   createTask carries every chosen field, then the created task opens. */

/* Activity notes carry raw field names; presentation maps them here. */
const FIELD_LABEL: Record<string, string> = {
  title: "Title", description: "Description", projectId: "Project", date: "Date", objectiveId: "Objective",
  projectDir: "Project" /* pre-D18 activity notes */
};

interface TimelineEntry {
  at: string;
  icon: IconName;
  text: string;
}

/* Create-mode staging: the fields createTask accepts, held locally until
   the footer's Create fires the one createTask call. */
interface DraftTask {
  title: string;
  description?: string;
  objectiveId?: string;
  projectId?: string;
  date?: string;
  status: Status;
}

/* View-mode staging: the fields updateTask accepts plus status (which
   persists through moveStatus on Save, never updateTask). A key explicitly
   set to undefined means "clear this field on Save" (it travels as null
   over HTTP — see api.ts updateTask). */
type StagedPatch = Partial<Pick<TaskDetail["task"], "title" | "description" | "objectiveId" | "projectId" | "date" | "status">>;

export function TaskModal({ state, taskId, onClose, onOpenObjective, mode = "view", objectiveId, onCreated }: {
  state: AppState;
  taskId?: string; // absent in create mode
  onClose: () => void;
  onOpenObjective?: (id: string) => void;
  mode?: "view" | "edit" | "create";
  objectiveId?: string; // create only: preselected objective
  onCreated?: (id: string) => void; // create only: receives the new id
}) {
  const isCreate = mode === "create";
  const { objectives, projects, sessions } = useBootstrap(state);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [draftTask, setDraftTask] = useState<DraftTask>({ title: "", status: "planned", objectiveId });
  const [staged, setStaged] = useState<StagedPatch>({});
  const [busy, setBusy] = useState(false);
  /* create opens straight into the title, matching the edit-entry path */
  const [editingField, setEditingField] = useState<"title" | "description" | null>(isCreate ? "title" : null);
  const [draft, setDraft] = useState("");
  const [openMenu, setOpenMenu] = useState<"status" | "objective" | "project" | "date" | null>(null);
  const [packText, setPackText] = useState<string | null>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const objectiveRef = useRef<HTMLButtonElement>(null);
  const projectRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const skipCommit = useRef(false);
  const focusedOnEntry = useRef(false);

  const refresh = () => (taskId ? state.client.taskDetail(taskId).then(setDetail) : Promise.resolve());

  useEffect(() => {
    if (isCreate) return;
    setStaged((s) => (Object.keys(s).length ? {} : s)); // staged edits never survive a task switch
    void refresh();
    return state.subscribe(() => void refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  /* mode="edit" (create-then-edit entry): focus the title input, nothing more */
  useEffect(() => {
    if (mode === "edit" && detail && !focusedOnEntry.current) {
      focusedOnEntry.current = true;
      skipCommit.current = false;
      setDraft(detail.task.title);
      setEditingField("title");
    }
  }, [mode, detail]);

  const persisted = detail?.task;
  /* the rendered task carries staged edits over the persisted record */
  const task = isCreate ? draftTask : persisted && { ...persisted, ...staged };
  /* crumbs render the persisted objective: the chain moves on Save */
  const chain = useMemo(() => {
    const out: Objective[] = [];
    let cur = objectives.find((o) => o.id === persisted?.objectiveId);
    while (cur) {
      out.unshift(cur);
      cur = objectives.find((o) => o.id === cur?.parentId);
    }
    return out;
  }, [objectives, persisted?.objectiveId]);

  /* every project is an assignment target (D18), name-ordered */
  const projectOptions = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  /* the task's linked sessions, newest first — the side rail's Session
     field (dogfood r3: a session is the task's thread, not an artifact) */
  const linkedSessions = useMemo(
    () =>
      (persisted?.linkedSessionIds ?? [])
        .flatMap((id) => sessions.filter((s) => s.id === id))
        .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)),
    [sessions, persisted?.linkedSessionIds]
  );

  /* pending link suggestions pointing at this task — their one surface
     now that the Projects session lists retired (D18) */
  const suggestedSessions = useMemo(
    () =>
      taskId
        ? sessions.flatMap((session) => {
            const pending = session.suggestions.find((s) => s.taskId === taskId && s.state === "pending");
            return pending ? [{ session, confidence: pending.confidence }] : [];
          })
        : [],
    [sessions, taskId]
  );

  const resolveSuggestion = async (sessionId: string, accept: boolean) => {
    await state.client.resolveSuggestion(sessionId, taskId!, accept);
    await state.refresh();
    void refresh();
  };

  /* Objective menu rows: L1s in store order, each followed by its indented
     L2 children — the Backlog tree flattened to one list (r1B.3 §1). */
  const objectiveRows = useMemo(() => {
    const rows: { objective: Objective; indent: boolean }[] = [];
    for (const o1 of objectives.filter((o) => o.level === 1)) {
      rows.push({ objective: o1, indent: false });
      for (const o2 of objectives.filter((o) => o.parentId === o1.id)) rows.push({ objective: o2, indent: true });
    }
    return rows;
  }, [objectives]);

  /* view mode loads async behind a shape-matched skeleton (dogfood r4.1):
     the panel opens at its settled size and nothing jumps when the
     detail lands */
  if (!task) {
    return (
      <ModalWrap onClose={onClose}>
        <div className="dm" style={{ minHeight: "28rem" }} aria-busy="true">
          <div className="dm-head">
            <span className="crumbs"><span className="skel skel-text" style={{ width: "9rem" }} /></span>
            <h4 className="dm-title">
              <span className="skel skel-text" style={{ width: "55%", height: "1.05em" }} />
              <button type="button" className="btn btn-quiet btn-icon dm-close" aria-label="Close" onClick={onClose}>
                <Icon name="x" />
              </button>
            </h4>
          </div>
          <div className="dm-body dm-body-fixed">
            <div className="dm-main">
              <div className="sec-head"><span className="lbl">Description</span></div>
              <span className="skel skel-text" style={{ width: "80%" }} />
              <span className="skel skel-text" style={{ width: "60%" }} />
            </div>
            <div className="dm-side">
              {["Status", "Objective", "Project", "Date"].map((lbl) => (
                <div className="field" key={lbl}>
                  <span className="lbl">{lbl}</span>
                  <span className="skel skel-text" style={{ width: "70%" }} />
                </div>
              ))}
            </div>
          </div>
          <div className="dm-foot">
            <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary" disabled>Save</button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  /* the side-rail field shows the task's own objective (the chain's leaf) */
  const fieldObjective = objectives.find((o) => o.id === task.objectiveId);

  /* Dispatch needs somewhere to land: the persisted project's folder.
     Staged picks don't count until Save — the server reads the store. */
  const dispatchDir = projects.find((p) => p.id === persisted?.projectId)?.dir;

  /* One field-write path for both modes, and neither touches the store:
     create stages into the draft, view stages into the dirty map (an
     explicit undefined stays staged as "clear on Save"). */
  const applyPatch = (patch: StagedPatch) => {
    if (isCreate) setDraftTask((d) => ({ ...d, ...patch }));
    else setStaged((s) => ({ ...s, ...patch }));
  };

  const startEdit = (field: "title" | "description") => {
    skipCommit.current = false;
    setDraft(field === "title" ? task.title : task.description ?? "");
    setEditingField(field);
  };

  /* Commit on Enter/blur through the one update path; an empty title or a
     no-op edit commits nothing (and logs nothing). */
  const commitEdit = () => {
    if (!editingField) return;
    const field = editingField;
    setEditingField(null);
    if (field === "title") {
      const value = draft.trim();
      if (value === task.title) return;
      if (!value && !isCreate) return; // a saved task never loses its title; a draft may sit empty
      applyPatch({ title: value });
    } else {
      const value = draft.trim() ? draft : "";
      if (value === (task.description ?? "")) return;
      applyPatch({ description: value });
    }
  };

  const cancelEdit = () => {
    skipCommit.current = true;
    setEditingField(null);
  };

  const blurCommit = () => {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    commitEdit();
  };

  /* the status pick stages like every other field (dogfood r4); Save
     persists it through moveStatus so the move logs as a move */
  const moveTo = (to: Status) => {
    setOpenMenu(null);
    if (isCreate) setDraftTask((d) => ({ ...d, status: to }));
    else applyPatch({ status: to });
  };

  /* Create reads the in-flight inline edit too: mousedown on the footer
     blurs (and commits) the input, but the click closure predates that
     state — reading the live draft keeps one click enough. */
  const pendingTitle = (editingField === "title" ? draft : task.title).trim();
  const create = async () => {
    if (!pendingTitle) return;
    const description = editingField === "description" ? draft : draftTask.description;
    setBusy(true);
    try {
      const created = await state.client.createTask({
        title: pendingTitle,
        description: description?.trim() ? description : undefined,
        objectiveId: draftTask.objectiveId,
        projectId: draftTask.projectId,
        date: draftTask.date,
        status: draftTask.status
      });
      await state.refresh();
      if (onCreated) onCreated(created.id);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  /* Save folds in the in-flight inline edit the same way Create does: the
     footer's mousedown blurs (and stages) the field, but this render's
     closure predates that state — reading the live draft keeps one click
     enough, and lights Save up while the edit is still open. Dirty means
     staged-and-different from the persisted record ("" and unset compare
     equal, so clearing an already-empty field stays clean). */
  const effectiveStaged: StagedPatch = (() => {
    if (isCreate || !editingField) return staged;
    if (editingField === "title") {
      const value = draft.trim();
      return value ? { ...staged, title: value } : staged;
    }
    return { ...staged, description: draft.trim() ? draft : "" };
  })();
  const dirtyFields = persisted
    ? (Object.keys(effectiveStaged) as (keyof StagedPatch)[]).filter(
        (k) => (effectiveStaged[k] ?? "") !== (persisted[k] ?? "")
      )
    : [];

  /* One updateTask carries every dirty field (the store logs one "updated"
     entry with the changed-field list); a staged status rides its own
     moveStatus so the move logs as a move. */
  const save = async () => {
    if (!persisted || dirtyFields.length === 0) return;
    const fieldKeys = dirtyFields.filter((k) => k !== "status");
    const patch = Object.fromEntries(fieldKeys.map((k) => [k, effectiveStaged[k]])) as Omit<StagedPatch, "status">;
    setBusy(true);
    try {
      if (fieldKeys.length > 0) await state.client.updateTask(persisted.id, patch);
      if (dirtyFields.includes("status") && effectiveStaged.status) {
        await state.client.moveStatus(persisted.id, effectiveStaged.status);
      }
      await Promise.all([state.refresh(), refresh()]);
      setStaged({});
    } finally {
      setBusy(false);
    }
  };

  const timeline: TimelineEntry[] = [];
  if (detail) for (const a of detail.activity) {
    if (a.kind === "created") timeline.push({ at: a.at, icon: "plus", text: "Created" });
    else if (a.kind === "status") {
      const suffix = a.by === "automation" ? " on evidence" : "";
      timeline.push({ at: a.at, icon: "arrow", text: `Moved to ${STATUS_LABEL[a.to ?? "planned"]}${suffix}` });
    } else if (a.kind === "updated") {
      const fields = (a.note ?? "").split(",").map((f) => FIELD_LABEL[f.trim()] ?? f.trim()).filter(Boolean);
      timeline.push({ at: a.at, icon: "pencil", text: fields.length ? `${fields.join(", ")} updated` : "Updated" });
    } else if (a.kind === "dispatched") timeline.push({ at: a.at, icon: "session", text: "Dispatched. Session starting" });
    else if (a.kind === "linked") timeline.push({ at: a.at, icon: "session", text: "Session linked" });
  }
  if (detail) for (const e of detail.evidence) {
    if (e.kind === "commit-ref") {
      const sha = String(e.payload.sha ?? "").slice(0, 7);
      const subject = e.payload.subject ? `: ${String(e.payload.subject).split("\n")[0]}` : "";
      timeline.push({ at: e.at, icon: "commit", text: `Commit ${sha}${subject}` });
    } else if (e.kind === "pr-ref") {
      timeline.push({ at: e.at, icon: "pr", text: `Opened PR ${String(e.payload.label ?? "")}` });
    } else if (e.kind === "outcome-claim") {
      timeline.push({ at: e.at, icon: "session", text: `Session claims: ${String(e.payload.text ?? "").slice(0, 80)}` });
    }
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ModalWrap onClose={onClose}>
      <div className="dm">
        <div className="dm-head">
          {isCreate ? (
            <span className="crumbs"><span>New task</span></span>
          ) : chain.length > 0 ? (
            <span className="crumbs">
              {chain.map((o, i) => (
                <span key={o.id} style={{ display: "contents" }}>
                  <CrumbLink objective={o} onOpen={(id) => onOpenObjective?.(id)} />
                  {i < chain.length - 1 && <span>/</span>}
                </span>
              ))}
            </span>
          ) : (
            /* the crumb slot never collapses (dogfood r3): every task modal
               keeps the same header height, linked or not */
            <span className="crumbs"><span>No objective linked</span></span>
          )}
          <h4 className="dm-title">
            {editingField === "title" ? (
              <input
                className="title-edit"
                type="text"
                value={draft}
                autoFocus
                aria-label="Task title"
                placeholder={isCreate ? "Task title" : undefined}
                onFocus={(e) => {
                  /* caret to the end, never select-all: a click means edit,
                     not replace (same grammar as the description) */
                  const end = e.currentTarget.value.length;
                  e.currentTarget.setSelectionRange(end, end);
                }}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                  else if (e.key === "Escape") { e.stopPropagation(); cancelEdit(); }
                }}
                onBlur={blurCommit}
              />
            ) : (
              <button type="button" className="title-text" title={task.title || undefined} onClick={() => startEdit("title")}>
                {task.title || <span style={{ color: "var(--gray-700)" }}>Task title</span>}
              </button>
            )}
            {/* the title row carries the main action (r1B.2 header grammar;
                moved up from the footer, dogfood r3) */}
            {!isCreate && task.status === "planned" && (
              /* dispatch acts on the persisted task; staged edits (a
                 just-picked project) haven't saved yet, so the button
                 waits for Save — else it dispatches yesterday's project */
              <button
                type="button"
                className="btn btn-secondary btn-small dm-act-btn"
                disabled={busy || dirtyFields.length > 0 || !dispatchDir}
                title={
                  dirtyFields.length > 0
                    ? "Save changes first"
                    : !dispatchDir
                      ? "Set a project with a folder, then save"
                      : undefined
                }
                onClick={() =>
                  void state.client.dispatch(persisted!.id).then((res) => {
                    if (!res.launched) setPackText(res.pack); // demo: show the pack, replay streams behind
                    void refresh();
                  })
                }
              >
                <Icon name="dispatch" />Dispatch
              </button>
            )}
            <button type="button" className="btn btn-quiet btn-icon dm-close" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </button>
          </h4>
        </div>
        {/* view: the body is fixed — the Activity timeline and the side rail
            scroll independently inside it (r1B.3 item 3); create (no
            Activity) keeps the one scrolling body region */}
        <div className={isCreate ? "dm-body dm-scroll" : "dm-body dm-body-fixed"}>
          <div className="dm-main">
            <div>
              <div className="sec-head"><span className="lbl">Description</span></div>
              {editingField === "description" ? (
                <textarea
                  className="desc desc-edit"
                  value={draft}
                  autoFocus
                  aria-label="Task description"
                  onFocus={(e) => {
                    const end = e.currentTarget.value.length;
                    e.currentTarget.setSelectionRange(end, end);
                  }}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.stopPropagation(); cancelEdit(); }
                    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitEdit(); }
                  }}
                  onBlur={blurCommit}
                />
              ) : (
                <button type="button" className="desc" onClick={() => startEdit("description")}>
                  {task.description || "No description"}
                </button>
              )}
            </div>
            {!isCreate && (
              <div className="dm-act">
                <div className="sec-head"><span className="lbl">Activity</span></div>
                <div className="tl-scroll">
                  <div className="tl">
                    {timeline.map((entry, i) => (
                      <div className="tl-row" key={i}>
                        <span className="node"><Icon name={entry.icon} /></span>
                        <span className="txt"><span className="ts">{fmtTs(entry.at)}</span>{entry.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="dm-side">
            <div className="field">
              <span className="lbl">Status</span>
              <button type="button" ref={statusRef} className="field-btn" onClick={() => setOpenMenu(openMenu === "status" ? null : "status")}>
                <StatusBadge status={task.status} />
                <svg className="icon caret" aria-hidden="true"><use href="#i-caret" /></svg>
              </button>
              {openMenu === "status" && (
                <Popover anchorRef={statusRef} onClose={() => setOpenMenu(null)}><div className="menu">
                  {STATUSES.filter((s) => s !== task.status).map((s) => (
                    <button key={s} type="button" className="menu-item" onClick={() => moveTo(s)}>
                      <StatusBadge status={s} />
                    </button>
                  ))}
                </div></Popover>
              )}
            </div>
            <div className="field">
              <span className="lbl">Objective</span>
              <button type="button" ref={objectiveRef} className="field-btn" title={fieldObjective?.title} onClick={() => setOpenMenu(openMenu === "objective" ? null : "objective")}>
                {fieldObjective ? <span className="obj-lbl">{fieldObjective.title}</span> : <span style={{ color: "var(--gray-800)" }}>None</span>}
                <svg className="icon caret" aria-hidden="true"><use href="#i-caret" /></svg>
              </button>
              {openMenu === "objective" && (
                <Popover anchorRef={objectiveRef} onClose={() => setOpenMenu(null)}><div className="menu">
                  {objectiveRows.map(({ objective, indent }) => (
                    <button
                      key={objective.id}
                      type="button"
                      className="menu-item"
                      style={indent ? { paddingLeft: "calc(var(--space-3) + var(--space-4))" } : undefined}
                      onClick={() => { setOpenMenu(null); applyPatch({ objectiveId: objective.id }); }}
                    >
                      {objective.title}
                    </button>
                  ))}
                  <button type="button" className="menu-item sep-above" onClick={() => { setOpenMenu(null); applyPatch({ objectiveId: undefined }); }}>None</button>
                </div></Popover>
              )}
            </div>
            <div className="field">
              <span className="lbl">Project</span>
              <button type="button" ref={projectRef} className="field-btn" onClick={() => setOpenMenu(openMenu === "project" ? null : "project")}>
                {task.projectId ? <ProjectPill name={projectName(projects, task.projectId)} /> : <span style={{ color: "var(--gray-800)" }}>None</span>}
                <svg className="icon caret" aria-hidden="true"><use href="#i-caret" /></svg>
              </button>
              {openMenu === "project" && (
                <Popover anchorRef={projectRef} onClose={() => setOpenMenu(null)}><div className="menu">
                  {projectOptions.map((p) => (
                    /* one name per row; the full directory rides the hover
                       title (r5.2 walked the r5 dir-leaf hint back — the
                       leaf mostly restated the name) */
                    <button key={p.id} type="button" className="menu-item" title={p.dir ?? p.name} onClick={() => { setOpenMenu(null); applyPatch({ projectId: p.id }); }}>
                      <Icon name="folder" /><span className="proj-lbl">{p.name}</span>
                    </button>
                  ))}
                  <button type="button" className="menu-item sep-above" onClick={() => { setOpenMenu(null); applyPatch({ projectId: undefined }); }}>None</button>
                </div></Popover>
              )}
            </div>
            <div className="field">
              <span className="lbl">Date</span>
              <button type="button" ref={dateRef} className="field-btn" onClick={() => setOpenMenu(openMenu === "date" ? null : "date")}>
                <Icon name="calendar" className="" />
                {task.date ? fmtShort(task.date) : <span style={{ color: "var(--gray-800)" }}>None</span>}
                <svg className="icon caret" aria-hidden="true"><use href="#i-caret" /></svg>
              </button>
              {openMenu === "date" && (
                <Popover anchorRef={dateRef} onClose={() => setOpenMenu(null)}>
                  <CalendarPopoverField anchor={task.date} onPick={(d) => { setOpenMenu(null); applyPatch({ date: d }); }} />
                </Popover>
              )}
            </div>
            {suggestedSessions.length > 0 && (
              <div className="field">
                <span className="lbl">Suggested sessions</span>
                {suggestedSessions.map(({ session, confidence }) => (
                  <div key={session.id} className="suggest-row">
                    <span className="what" title={session.title ?? session.firstPrompt}>
                      {session.title ?? session.firstPrompt ?? session.id.slice(0, 8)}
                    </span>
                    <span className="meta">{fmtTs(session.startedAt)} · {confidence.toFixed(2)}</span>
                    <span className="acts">
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => void resolveSuggestion(session.id, true)}>
                        Confirm link
                      </button>
                      <button type="button" className="btn btn-quiet btn-small" onClick={() => void resolveSuggestion(session.id, false)}>
                        Dismiss
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* sessions are the task's own field, not an artifact (dogfood
                r3): the link resumes the session in a terminal */}
            {!isCreate && (
              <div className="field">
                <span className="lbl">Session</span>
                {linkedSessions.length === 0 && (
                  <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>None</span>
                )}
                {linkedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className="art-row"
                    title={session.title ?? session.firstPrompt}
                    onClick={() => void state.client.openArtifact({ kind: "session", label: "session", sessionId: session.id, at: "" })}
                  >
                    <Icon name="session" />
                    <span className="wrap2">{session.title ?? session.firstPrompt ?? session.id.slice(0, 8)}</span>
                    <svg className="icon go" aria-hidden="true"><use href="#i-link" /></svg>
                  </button>
                ))}
              </div>
            )}
            {detail && (
              <div className="field">
                <span className="lbl">Artifacts</span>
                {detail.artifacts.length === 0 && (
                  <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>No artifacts attached</span>
                )}
                {detail.artifacts.map((artifact, i) => (
                  <button key={i} type="button" className="art-row" onClick={() => void state.client.openArtifact(artifact)}>
                    <Icon name={artifactIcon(artifact)} />
                    {artifact.label}
                    <svg className="icon go" aria-hidden="true"><use href="#i-link" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="dm-foot">
          {isCreate ? (
            <>
              <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={busy || !pendingTitle} onClick={() => void create()}>Create</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-primary" disabled={busy || dirtyFields.length === 0} onClick={() => void save()}>Save</button>
            </>
          )}
        </div>
      </div>
      {packText && (
        <div className="dm-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) setPackText(null); }}>
          <div className="dm" style={{ width: "42rem" }}>
            <div className="dm-head">
              <h4 className="dm-title">
                <span className="title-text">Context pack</span>
                <button type="button" className="btn btn-quiet btn-icon dm-close" aria-label="Close" onClick={() => setPackText(null)}>
                  <Icon name="x" />
                </button>
              </h4>
              {/* demo declaration (story 12): the stream is a replay */}
              {state.client.mode === "demo" && (
                <span className="dm-sub">The pack below is what a live dispatch sends. The status stream that follows is a replay. In the local app, dispatch opens a terminal.</span>
              )}
            </div>
            <div className="dm-main dm-scroll" style={{ paddingBottom: "var(--space-6)" }}>
              <pre style={{ font: "var(--type-data)", color: "var(--gray-900)", whiteSpace: "pre-wrap", margin: 0 }}>{packText}</pre>
            </div>
            <div className="dm-foot">
              <button type="button" className="btn btn-quiet" onClick={() => setPackText(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </ModalWrap>
  );
}

function CrumbLink({ objective, onOpen }: { objective: Objective; onOpen: (id: string) => void }) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onOpen(objective.id);
      }}
    >
      {objective.title}
    </a>
  );
}
