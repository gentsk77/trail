import { useEffect, useState } from "react";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { Icon } from "./Icons";
import { ModalWrap } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/* Project modal (D18): the established modal grammar, single narrow
   column — name and directory, nothing else. Directory is optional
   (clearing it is legal: the project keeps its tasks and stops mapping
   to a folder). Create is this modal empty. Save owns the primary slot
   and stays disabled until dirty (D11/D16 grammar). No delete in v0 —
   a project with history is evidence. */

export function ProjectModal({ state, projectId, onClose }: {
  state: AppState;
  projectId?: string; // absent = create
  onClose: () => void;
}) {
  const { projects } = useBootstrap(state);
  const project = projects.find((p) => p.id === projectId);
  const isCreate = !projectId;
  const [name, setName] = useState(project?.name ?? "");
  const [dir, setDir] = useState(project?.dir ?? "");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  /* dirty = different from the persisted record; "" and unset compare equal */
  const dirty = name.trim() !== (project?.name ?? "") || dir.trim() !== (project?.dir ?? "");
  const canSave = !busy && name.trim() !== "" && (isCreate || dirty);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const patch = { name: name.trim(), dir: dir.trim() || undefined };
      if (isCreate) await state.client.createProject(patch);
      else await state.client.updateProject(projectId, patch);
      await state.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  /* live-local only: Choose folder opens the OS folder dialog through the
     sidecar (dogfood r2, supersedes the r1 in-app browser) and lands the
     pick in the input; the demo's plain text input is the whole affordance
     (browsers cannot expose real paths) */
  const browse = async () => {
    setPicking(true);
    try {
      const res = await fetch("/api/fs/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: dir.trim() || undefined })
      });
      if (res.ok) {
        const out = (await res.json()) as { path?: string };
        if (out.path) setDir(out.path);
      }
    } finally {
      setPicking(false);
    }
  };

  useEffect(() => {
    setName(project?.name ?? "");
    setDir(project?.dir ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <ModalWrap label={isCreate ? "New project" : "Edit project"} onClose={onClose}>
      <div className="dm" style={{ width: "26rem" }}>
        <div className="dm-head">
          <h4 className="dm-title">
            <span className="title-text">{isCreate ? "New project" : "Edit project"}</span>
            <Button className="dm-close" variant="quiet" size="icon" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </Button>
          </h4>
        </div>
        <div className="dm-body dm-scroll">
          <div className="dm-main">
            <div className="field">
              <span className="lbl">Name</span>
              <Input
                type="text"
                value={name}
                autoFocus={isCreate}
                aria-label="Project name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <span className="lbl">Directory</span>
              <div className="dir-row">
                <Input
                  type="text"
                  value={dir}
                  aria-label="Project directory"
                  onChange={(e) => setDir(e.target.value)}
                />
                {state.client.mode === "live" && (
                  <Button variant="secondary" disabled={picking} onClick={() => void browse()}>
                    Choose folder
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="dm-foot">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
            {isCreate ? "Create" : "Save"}
          </Button>
        </div>
      </div>
    </ModalWrap>
  );
}
