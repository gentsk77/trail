import { useMemo, useRef, useState } from "react";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { fmtShort } from "../lib/dates";
import { Icon } from "./Icons";
import { ModalWrap } from "./ui/dialog";
import { Popover } from "./ui/popover";
import { ProjectPill, projectName } from "./ProjectPill";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";

/* Objective detail on the task modal's exact anatomy (dogfood r3):
   editable title in the header, description then Tasks in the main
   column, parent and child objective links in the side rail. Create is
   this same modal blank (the task-modal rule): title and description
   stage into a draft, the side rail carries the one Parent picker, and
   Create fires a single createObjective. In view, parent and children
   are links — restructuring the tree is not a modal edit in v0. */

export function ObjectiveModal({ state, objectiveId, onClose, onOpenTask, onOpenObjective }: {
  state: AppState;
  objectiveId?: string; // absent = create
  onClose: () => void;
  onOpenTask?: (id: string) => void;
  onOpenObjective?: (id: string) => void;
}) {
  const { objectives, tasks, projects } = useBootstrap(state);
  const isCreate = !objectiveId;
  const objective = objectives.find((o) => o.id === objectiveId);
  const [staged, setStaged] = useState<{ title?: string; description?: string }>({});
  const [draftParentId, setDraftParentId] = useState<string | undefined>(undefined);
  const [editingField, setEditingField] = useState<"title" | "description" | null>(isCreate ? "title" : null);
  const [draft, setDraft] = useState("");
  const [parentMenu, setParentMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const parentRef = useRef<HTMLButtonElement>(null);
  const skipCommit = useRef(false);

  const level1 = objectives.filter((o) => o.level === 1);
  const parent = objectives.find((o) => o.id === (isCreate ? draftParentId : objective?.parentId));
  const childObjectives = useMemo(() => objectives.filter((o) => o.parentId === objectiveId), [objectives, objectiveId]);
  const childTasks = useMemo(() => tasks.filter((t) => t.objectiveId === objectiveId), [tasks, objectiveId]);

  if (!isCreate && !objective) return null;

  const shown = {
    title: staged.title ?? objective?.title ?? "",
    description: staged.description ?? objective?.description ?? ""
  };

  const startEdit = (field: "title" | "description") => {
    skipCommit.current = false;
    setDraft(field === "title" ? shown.title : shown.description);
    setEditingField(field);
  };

  const commitEdit = () => {
    if (!editingField) return;
    const field = editingField;
    setEditingField(null);
    if (field === "title") {
      const value = draft.trim();
      if (!value && !isCreate) return; // a saved objective never loses its title
      if (value !== shown.title) setStaged((s) => ({ ...s, title: value }));
    } else if (draft !== shown.description) {
      setStaged((s) => ({ ...s, description: draft.trim() ? draft : "" }));
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

  /* the footer reads the in-flight inline edit too (the task-modal rule):
     one click is enough while the field is still open */
  const pendingTitle = (editingField === "title" ? draft : shown.title).trim();
  const pendingDescription = editingField === "description" ? draft : shown.description;
  const dirty =
    (pendingTitle && pendingTitle !== (objective?.title ?? "")) ||
    pendingDescription !== (objective?.description ?? "");

  const create = async () => {
    if (!pendingTitle) return;
    setBusy(true);
    try {
      await state.client.createObjective({
        title: pendingTitle,
        level: draftParentId ? 2 : 1,
        parentId: draftParentId,
        description: pendingDescription.trim() ? pendingDescription : undefined
      });
      await state.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!objective || !dirty) return;
    setBusy(true);
    try {
      await state.client.updateObjective(objective.id, {
        ...(pendingTitle !== objective.title ? { title: pendingTitle } : {}),
        ...(pendingDescription !== (objective.description ?? "") ? { description: pendingDescription } : {})
      });
      await state.refresh();
      setStaged({});
    } finally {
      setBusy(false);
    }
  };

  const done = childTasks.filter((t) => t.status === "done").length;
  const open = childTasks.length - done;
  const rollup = childTasks.length === 0
    ? "No tasks yet"
    : [done > 0 ? `${done} done` : null, open > 0 ? `${open} open` : null].filter(Boolean).join(" · ");

  return (
    <ModalWrap label={isCreate ? "New objective" : "Objective detail"} onClose={onClose}>
      {/* one height either mode (dogfood r4.1): the blank create panel
          stands as tall as a typical view, so the swap never shrinks it */}
      <div className="dm" style={{ minHeight: "26rem" }}>
        <div className="dm-head">
          {isCreate ? (
            <span className="crumbs"><span>New objective</span></span>
          ) : parent ? (
            <span className="crumbs">
              <a href="#" onClick={(e) => { e.preventDefault(); onOpenObjective?.(parent.id); }}>{parent.title}</a>
            </span>
          ) : (
            /* the crumb slot never collapses (dogfood r3) */
            <span className="crumbs"><span>No parent objective</span></span>
          )}
          <h4 className="dm-title">
            {editingField === "title" ? (
              <input
                className="title-edit"
                type="text"
                value={draft}
                autoFocus
                aria-label="Objective title"
                placeholder={isCreate ? "Objective title" : undefined}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                  else if (e.key === "Escape") { e.stopPropagation(); cancelEdit(); }
                }}
                onBlur={blurCommit}
              />
            ) : (
              <button type="button" className="title-text" title={shown.title || undefined} onClick={() => startEdit("title")}>
                {shown.title || <span style={{ color: "var(--gray-700)" }}>Objective title</span>}
              </button>
            )}
            <Button className="dm-close" variant="quiet" size="icon" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </Button>
          </h4>
          {!isCreate && <span className="dm-sub">{rollup}</span>}
        </div>
        {/* view mirrors the task modal (dogfood r4): body fixed, the Tasks
            list is the one scroll region; create (no Tasks) keeps the one
            scrolling body */}
        <div className={isCreate ? "dm-body dm-scroll" : "dm-body dm-body-fixed"}>
          <div className="dm-main">
            <div>
              <div className="sec-head"><span className="lbl">Description</span></div>
              {editingField === "description" ? (
                <textarea
                  className="desc desc-edit"
                  value={draft}
                  autoFocus
                  aria-label="Objective description"
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
                  {shown.description || "No description"}
                </button>
              )}
            </div>
            {/* the rollup line already says an empty body out loud — the
                section renders only with rows to show */}
            {!isCreate && childTasks.length > 0 && (
              <div className="dm-act">
                <div className="sec-head"><span className="lbl">Tasks</span></div>
                <div className="tl-scroll">
                  <div className="tree" style={{ borderRadius: "var(--radius-s)", marginTop: "var(--space-2)" }}>
                    {childTasks.map((t) => (
                      <button key={t.id} type="button" className="tree-row" onClick={() => onOpenTask?.(t.id)}>
                        <span className="title">{t.title}</span>
                        <ProjectPill name={projectName(projects, t.projectId)} />
                        <StatusBadge status={t.status} />
                        {t.status !== "shelved" && t.date && <span className="when">{fmtShort(t.date)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="dm-side">
            <div className="field">
              <span className="lbl">Parent objective</span>
              {isCreate ? (
                <>
                  <button type="button" ref={parentRef} className="field-btn" onClick={() => setParentMenu(!parentMenu)}>
                    {parent ? <span className="obj-lbl">{parent.title}</span> : <span style={{ color: "var(--gray-800)" }}>None (life-level)</span>}
                    <svg className="icon caret" aria-hidden="true"><use href="#i-caret" /></svg>
                  </button>
                  {parentMenu && (
                    <Popover anchorRef={parentRef} onClose={() => setParentMenu(false)}><div className="menu">
                      {level1.map((o) => (
                        <button key={o.id} type="button" className="menu-item" onClick={() => { setDraftParentId(o.id); setParentMenu(false); }}>
                          <span className="obj-lbl">{o.title}</span>
                        </button>
                      ))}
                      <button type="button" className="menu-item sep-above" onClick={() => { setDraftParentId(undefined); setParentMenu(false); }}>None (life-level)</button>
                    </div></Popover>
                  )}
                </>
              ) : parent ? (
                <button type="button" className="art-row" title={parent.title} onClick={() => onOpenObjective?.(parent.id)}>
                  <Icon name="flag" />
                  <span className="obj-lbl">{parent.title}</span>
                  <svg className="icon go" aria-hidden="true"><use href="#i-link" /></svg>
                </button>
              ) : (
                <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>None</span>
              )}
            </div>
            {!isCreate && (
              <div className="field">
                <span className="lbl">Child objectives</span>
                {childObjectives.length === 0 && (
                  <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>None</span>
                )}
                {childObjectives.map((o) => (
                  <button key={o.id} type="button" className="art-row" title={o.title} onClick={() => onOpenObjective?.(o.id)}>
                    <Icon name="flag" />
                    <span className="obj-lbl">{o.title}</span>
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
              <Button variant="quiet" onClick={onClose}>Cancel</Button>
              <Button variant="primary" disabled={busy || !pendingTitle} onClick={() => void create()}>Create</Button>
            </>
          ) : (
            <>
              <Button variant="quiet" onClick={onClose}>Close</Button>
              <Button variant="primary" disabled={busy || !dirty} onClick={() => void save()}>Save</Button>
            </>
          )}
        </div>
      </div>
    </ModalWrap>
  );
}
