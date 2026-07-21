import { useEffect, useState } from "react";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { fmtTs } from "../lib/dates";
import type { AgentAppScan, ConnectProject, ConnectSelection } from "../lib/types";
import { Icon } from "./Icons";
import { ModalWrap } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Checkbox, CheckMark } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

/* Connect flow (dogfood r1B): settings is a menu; this modal owns agent-app
   connection alone. Step 1 picks the app, step 2 picks the projects and
   the sessions within them — one modal, stepper state; selection survives
   Back. Import brings in only the checked sessions; unselected projects
   are excluded from the watch. */

type Step = "apps" | "projects";

/* Loading placeholders (dogfood r4.1): shape-matched to the rows they
   stand in for, so the panel never resizes as the scan lands. */
function AppRowSkeletons() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="list-row" style={{ cursor: "default" }} aria-hidden="true">
          <Skeleton circle style={{ width: 18, height: 18, flex: "none" }} />
          <Skeleton style={{ width: 20, height: 20, borderRadius: "var(--radius-s)", flex: "none" }} />
          <Skeleton text style={{ width: "7rem" }} />
          <span className="end"><Skeleton text style={{ width: "5rem" }} /></span>
        </div>
      ))}
    </>
  );
}

function ProjectRowSkeletons() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="list-row" style={{ cursor: "default" }} aria-hidden="true">
          <Skeleton style={{ width: 18, height: 18, borderRadius: "var(--radius-xs)", flex: "none" }} />
          <Skeleton text style={{ width: `${11 + (i % 3) * 4}rem` }} />
          <span className="end"><Skeleton text style={{ width: "5.5rem" }} /></span>
        </div>
      ))}
    </>
  );
}

export function ConnectModal({ state, onClose }: { state: AppState; onClose: () => void }) {
  const { settings } = useBootstrap(state);
  const [step, setStep] = useState<Step>("apps");
  const [scan, setScan] = useState<AgentAppScan[] | null>(null);
  const [appChecked, setAppChecked] = useState(true);
  const [candidates, setCandidates] = useState<ConnectProject[] | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [sessSel, setSessSel] = useState<Map<string, Set<string>>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void state.client.connectScan().then((r) => setScan(r.apps));
  }, [state]);

  useEffect(() => {
    if (step !== "projects" || candidates !== null) return;
    void state.client.connectProjects().then(({ projects }) => {
      setCandidates(projects);
      setIncluded(new Set(projects.map((p) => p.storeDir)));
      setSessSel(new Map(projects.map((p) => [p.storeDir, new Set(p.sessions.map((s) => s.id))])));
    });
  }, [step, candidates, state]);

  const claude = scan?.find((a) => a.id === "claude-code");
  const connected = settings.connectedApps.includes("claude-code");

  const toggleProject = (storeDir: string) => {
    const next = new Set(included);
    next.has(storeDir) ? next.delete(storeDir) : next.add(storeDir);
    setIncluded(next);
  };

  const toggleSession = (storeDir: string, id: string) => {
    const next = new Map(sessSel);
    const set = new Set(next.get(storeDir));
    set.has(id) ? set.delete(id) : set.add(id);
    next.set(storeDir, set);
    setSessSel(next);
  };

  const toggleExpanded = (storeDir: string) => {
    const next = new Set(expanded);
    next.has(storeDir) ? next.delete(storeDir) : next.add(storeDir);
    setExpanded(next);
  };

  const allOn = candidates !== null && candidates.length > 0 && included.size === candidates.length;
  const setAll = (on: boolean) => {
    if (!candidates) return;
    setIncluded(on ? new Set(candidates.map((p) => p.storeDir)) : new Set());
    if (on) setSessSel(new Map(candidates.map((p) => [p.storeDir, new Set(p.sessions.map((s) => s.id))])));
  };

  const importSelection = async () => {
    if (!candidates) return;
    const selections: ConnectSelection[] = candidates
      .filter((p) => included.has(p.storeDir))
      .map((p) => {
        const chosen = sessSel.get(p.storeDir) ?? new Set<string>();
        return chosen.size === p.sessions.length
          ? { storeDir: p.storeDir }
          : { storeDir: p.storeDir, sessionIds: [...chosen] };
      });
    setBusy(true);
    try {
      await state.client.connectApp({ app: "claude-code", projects: selections });
      await state.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (step === "projects") {
    return (
      <ModalWrap label="Choose what to import" onClose={onClose}>
        {/* 40rem: the row spends ~76px on checkbox + carets + folder and up
            to ~140px on the count column ("12 of 34 sessions", data type);
            40rem leaves the name ~420px — a 40+char project or worktree
            name survives next to a full count, where 30rem cut it at ~25.
            Fixed height (dogfood r4.1): the scan loads async behind
            skeleton rows, and the panel never resizes as content lands. */}
        <div className="dm" style={{ width: "40rem", height: "min(34rem, 100%)" }}>
          <div className="dm-head">
            <h4 className="dm-title">
              <span className="title-text">Choose what to import</span>
              <Button className="dm-close" variant="quiet" size="icon" aria-label="Close" onClick={onClose}><Icon name="x" /></Button>
            </h4>
            <span className="dm-sub">
            {/* demo declaration (story 12): the import is a simulation */}
            {state.client.mode === "demo"
              ? "A simulated import over demo data. These sessions are fictional."
              : "Trail watches included projects and imports their new sessions."}
          </span>
          </div>
          <div className="dm-scroll" style={{ padding: "0 var(--space-6) var(--space-4)" }}>
            {(candidates?.length ?? 0) > 0 && (
              <div style={{ display: "flex", marginBottom: "var(--space-2)" }}>
                {/* the label never flips (dogfood r3.1): the checkbox carries the state */}
                <button type="button" className="sel-all" onClick={() => setAll(!allOn)}>
                  <CheckMark all={allOn} some={included.size > 0} />
                  Select all
                </button>
              </div>
            )}
            <div className="list">
              {candidates === null && <ProjectRowSkeletons />}
              {candidates?.length === 0 && (
                <div className="list-row" style={{ cursor: "default", color: "var(--gray-800)" }}>No sessions in the last 30 days</div>
              )}
              {(candidates ?? []).map((p) => {
                const on = included.has(p.storeDir);
                const open = expanded.has(p.storeDir);
                const chosen = sessSel.get(p.storeDir) ?? new Set<string>();
                const count = chosen.size === p.sessions.length
                  ? `${p.sessions.length} ${p.sessions.length === 1 ? "session" : "sessions"}`
                  : `${chosen.size} of ${p.sessions.length} sessions`;
                return (
                  <div key={p.storeDir}>
                    <div className="list-row">
                      <Checkbox checked={on} ariaLabel={`Include ${p.name}`} onCheckedChange={() => toggleProject(p.storeDir)} />
                      <button type="button" className="set-expand" aria-expanded={open} title={p.dir} onClick={() => toggleExpanded(p.storeDir)}>
                        <Icon name={open ? "caret" : "chevr"} />
                        <Icon name="folder" />
                        {open ? (
                          <span className="set-item">
                            <span className="title">{p.name}</span>
                            <span className="path">{p.dir}</span>
                          </span>
                        ) : (
                          <span className="title">{p.name}</span>
                        )}
                      </button>
                      <span className="end data">{count}</span>
                    </div>
                    {open && p.sessions.map((s) => {
                      /* memory of the pick survives a project toggle, but never renders while the parent is off */
                      const sessOn = on && chosen.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="list-row set-sess"
                          disabled={!on}
                          onClick={() => toggleSession(p.storeDir, s.id)}
                        >
                          <CheckMark all={sessOn} />
                          <span className="title" style={s.label ? undefined : { color: "var(--gray-800)" }}>
                            {s.label ?? "Untitled"}
                          </span>
                          <span className="end data">{fmtTs(s.lastActiveAt)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="dm-foot">
            <Button variant="quiet" onClick={() => setStep("apps")}>Back</Button>
            <Button variant="primary" disabled={busy || !candidates || included.size === 0} onClick={() => void importSelection()}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  return (
    <ModalWrap label="Connect to agents" onClose={onClose}>
      <div className="dm" style={{ width: "26rem" }}>
        <div className="dm-head">
          <h4 className="dm-title">
            {/* the settings menu item's name, verbatim (dogfood r4.1) */}
            <span className="title-text">Connect to agents</span>
            <Button className="dm-close" variant="quiet" size="icon" aria-label="Close" onClick={onClose}><Icon name="x" /></Button>
          </h4>
          <span className="dm-sub">
            {/* demo declaration (story 12): a visitor must never believe
                this reads their sessions */}
            {state.client.mode === "demo"
              ? "A simulated scan over demo data. Nothing on your machine is read. Connecting real agents needs the local app."
              : "Agent apps found on this machine. Trail reads their sessions and writes nothing."}
          </span>
        </div>
        <div className="dm-scroll" style={{ padding: "0 var(--space-6) var(--space-4)" }}>
          <div className="list">
            {scan === null && <AppRowSkeletons />}
            {(scan ?? []).map((app) => {
              /* scan-only vendors render honestly: found and counted, never selectable */
              const selectable = app.importable && app.found;
              const on = app.id === "claude-code" && appChecked && selectable;
              return (
                <button
                  key={app.id}
                  type="button"
                  className="list-row app-row"
                  disabled={!selectable}
                  onClick={() => app.id === "claude-code" && setAppChecked(!appChecked)}
                >
                  <CheckMark all={on} />
                  <span className={`app-tile ${app.id === "claude-code" ? "claude" : "codex"}`}>
                    <Icon name={app.id === "claude-code" ? "claude" : "codex"} />
                  </span>
                  <span className="title">{app.name}</span>
                  {/* state rides a chip beside the name (dogfood r4): every
                      row stays one line tall */}
                  {app.id === "claude-code" && connected && <Badge variant="chip"><span className="lbl">Connected</span></Badge>}
                  {!app.importable && app.found && <Badge variant="chip"><span className="lbl">Not supported</span></Badge>}
                  <span className="end">{app.found ? `${app.sessionCount} sessions` : "Not found"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="dm-foot">
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!appChecked || !claude?.found} onClick={() => setStep("projects")}>Continue</Button>
        </div>
      </div>
    </ModalWrap>
  );
}
