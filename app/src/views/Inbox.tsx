import { useEffect, useMemo, useRef, useState } from "react";
import { ArtifactTile } from "../components/ArtifactTile";
import { Icon } from "../components/Icons";
import { Popover } from "../components/Popover";
import { ProjectPill, projectName } from "../components/ProjectPill";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import type { InboxResult, InboxSignoffCard, InboxWaitingCard } from "../lib/inbox";
import { renderInlineMd } from "../lib/md";
import type { TrailClient } from "../lib/api";
import type { Artifact, Task } from "../lib/types";

/* The Inbox (D17): everything awaiting the operator's judgment, two
   sections, one primary in the whole view. Needs sign-off = Ready tasks
   oldest-Ready first, batch sign-off over the selection (the GitHub-
   notifications grammar, r2); Waiting on you = Waiting tasks with the
   agent's last message — answering happens in the session, so the
   section holds no buttons. Age lives in the ordering (r3). */

/* Filter key for tasks without a project ("No project" in the menu). */
const NO_PROJECT = "";

export function Inbox({ state }: {
  state: AppState;
}) {
  const { projects } = useBootstrap(state);
  const [inbox, setInbox] = useState<InboxResult | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  /* the Backlog's project-filter grammar (dogfood r5, ui r1): the filter
     starts empty and empty means unfiltered; a checked box narrows.
     Nothing-selected never means nothing-shown. Clear is the menu's own
     last row (ui r3), not a standalone action beside it. */
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<"project" | null>(null);
  const projectRef = useRef<HTMLButtonElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const refresh = () =>
      state.client.inbox().then((result) => {
        setInbox(result);
        /* first card ships expanded, the rest closed; later arrivals
           default closed and the operator's toggles stand */
        if (!seeded.current && result.signoff.length > 0) {
          seeded.current = true;
          setExpanded(new Set([result.signoff[0].task.id]));
        }
      });
    void refresh();
    return state.subscribe(() => void refresh());
  }, [state]);

  /* projects referenced by at least one card, name-ordered — the filter
     menu stays scoped to what the queue can show */
  const usedProjects = useMemo(() => {
    if (!inbox) return [];
    const ids = new Set(
      [...inbox.signoff, ...inbox.waiting].map((c) => c.task.projectId).filter(Boolean)
    );
    return projects.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [inbox, projects]);

  if (!inbox) return <div className="content"><div className="view-head"><h3>Inbox</h3></div></div>;

  const passes = (t: Task) => projectFilter.size === 0 || projectFilter.has(t.projectId ?? NO_PROJECT);
  const signoff = inbox.signoff.filter((c) => passes(c.task));
  const waiting = inbox.waiting.filter((c) => passes(c.task));
  /* the count carries the filter's honesty: "3 of 5" while it hides rows */
  const shownOf = (shown: number, all: number) => (shown === all ? `${all}` : `${shown} of ${all}`);

  /* the selection is only ever cards the filter shows — a batch sign-off
     can never touch a row the operator cannot see (the Backlog's law) */
  const signoffIds = new Set(signoff.map((c) => c.task.id));
  const selected = [...checked].filter((id) => signoffIds.has(id));

  const projectChecked = (key: string) => projectFilter.has(key);
  const toggleProject = (key: string) => {
    const next = new Set(projectFilter);
    next.has(key) ? next.delete(key) : next.add(key);
    setProjectFilter(next);
  };
  const toggleCheck = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  /* the manual Ready→Done move over the selection (D11 stands: this is
     the operator ratifying, automation still never sets Done) */
  const signOffSelected = async () => {
    const ids = selected;
    setBusy(true);
    try {
      for (const id of ids) await state.client.moveStatus(id, "done");
    } finally {
      await state.refresh();
      setChecked(new Set());
      setBusy(false);
    }
  };

  const openSession = (sessionId?: string) => {
    if (!sessionId) return;
    void state.client.openArtifact({ kind: "session", label: "session", sessionId, at: "" });
  };

  const bothEmpty = inbox.signoff.length === 0 && inbox.waiting.length === 0;

  return (
    <div className={bothEmpty ? "content content-fill" : "content"}>
      <div className="view-head"><h3>Inbox</h3></div>
      {bothEmpty ? (
        /* the clear queue is the product's win condition — it earns the
           one celebratory moment (D26): full-height, centered hero */
        <div className="empty-hero">
          <Icon name="celebration" />
          <span className="lede">You are all caught up!</span>
        </div>
      ) : (
        <>
          <div className="ib-sec">
            <span className="col-dot ready" />
            <span className="lbl">Needs sign-off</span>
            <span className="n">{shownOf(signoff.length, inbox.signoff.length)}</span>
            <span className="side">
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
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={busy || selected.length === 0}
                onClick={() => void signOffSelected()}
              >
                Sign off selected
              </button>
            </span>
          </div>
          {signoff.length === 0 && (
            <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>Nothing to sign off</span>
          )}
          {signoff.map((card) => (
            <SignoffCard
              key={card.task.id}
              card={card}
              client={state.client}
              project={projectName(projects, card.task.projectId)}
              checked={checked.has(card.task.id)}
              expanded={expanded.has(card.task.id)}
              onCheck={() => toggleCheck(card.task.id)}
              onExpand={() => toggleExpand(card.task.id)}
              onOpenSession={() => openSession(card.sessionId)}
              onOpenArtifact={(artifact) => void state.client.openArtifact(artifact)}
            />
          ))}
          <div className="ib-sec">
            <span className="col-dot waiting" />
            <span className="lbl">Waiting on you</span>
            <span className="n">{shownOf(waiting.length, inbox.waiting.length)}</span>
          </div>
          {waiting.length === 0 && (
            <span style={{ font: "var(--type-caption)", color: "var(--gray-800)" }}>Nothing waiting</span>
          )}
          {waiting.map((card) => (
            <WaitingCard
              key={card.task.id}
              card={card}
              project={projectName(projects, card.task.projectId)}
              onOpenSession={() => openSession(card.sessionId)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* Whole header = the disclosure target (r4/r5, ARIA disclosure pattern):
   checkbox and Open session except themselves. The title reads, never
   links — the review happens in the expanded strip, the task modal opens
   from the board and backlog. */
function SignoffCard({ card, client, project, checked, expanded, onCheck, onExpand, onOpenSession, onOpenArtifact }: {
  card: InboxSignoffCard;
  client: TrailClient;
  project?: string;
  checked: boolean;
  expanded: boolean;
  onCheck: () => void;
  onExpand: () => void;
  onOpenSession: () => void;
  onOpenArtifact: (artifact: Artifact) => void;
}) {
  const n = card.artifacts.length;
  return (
    <div className={expanded ? "ib-card" : "ib-card closed"}>
      <div
        className="ib-head"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest(".cbx, .ib-open")) return;
          onExpand();
        }}
      >
        <span
          role="checkbox"
          aria-checked={checked}
          aria-label={`Select ${card.task.title}`}
          tabIndex={0}
          className={checked ? "cbx checked" : "cbx"}
          onClick={(e) => { e.stopPropagation(); onCheck(); }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onCheck(); }
          }}
        >
          <Icon name="check" />
        </span>
        <button
          type="button"
          className="ib-caret"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
        >
          <Icon name="caret" />
        </button>
        <span className="title" title={card.task.title}>{card.task.title}</span>
        <ProjectPill name={project} />
        <span className="arts">{n === 1 ? "1 artifact" : `${n} artifacts`}</span>
        {card.sessionId && (
          <button type="button" className="ib-open" onClick={onOpenSession}>
            Open session<Icon name="link" />
          </button>
        )}
      </div>
      {card.artifacts.length > 0 ? (
        <div className="thumb-strip">
          {card.artifacts.map((artifact, i) => (
            <ArtifactTile key={i} artifact={artifact} client={client} onOpen={() => onOpenArtifact(artifact)} />
          ))}
        </div>
      ) : card.lastMessage ? (
        /* no artifacts: the agent's own claim is the only evidence, and it
           is exactly what the sign-off ratifies — the waiting-card excerpt
           treatment (D25); cards with artifacts stay artifact-first */
        <p className="ib-excerpt">{renderInlineMd(card.lastMessage)}</p>
      ) : null}
    </div>
  );
}

/* Waiting cards do not collapse: title, chip, the agent's last message
   clamped to three lines (agent-authored content; inline markdown renders,
   block markers strip — dogfood r2), and the one link-style affordance. */
function WaitingCard({ card, project, onOpenSession }: {
  card: InboxWaitingCard;
  project?: string;
  onOpenSession: () => void;
}) {
  return (
    <div className="ib-card">
      <div className="ib-head" style={{ cursor: "default" }}>
        <span className="title" title={card.task.title}>{card.task.title}</span>
        <ProjectPill name={project} />
        {card.sessionId && (
          <button type="button" className="ib-open" onClick={onOpenSession}>
            Open session<Icon name="link" />
          </button>
        )}
      </div>
      {card.lastMessage && <p className="ib-excerpt">{renderInlineMd(card.lastMessage)}</p>}
    </div>
  );
}

