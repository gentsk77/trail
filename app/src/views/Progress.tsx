import { useEffect, useMemo, useState } from "react";
import { ProjectPill, projectName } from "../components/ProjectPill";
import { StatusBadge } from "../components/StatusBadge";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { addDays, fmtDayLong, fmtShort, today, weekStart } from "../lib/dates";

/* Progress (D12, revised r1B): the activity grid is the long arc — twenty-
   six weeks, five shades, cell depth = the day's ready + done on one
   intensity scale; ready-vs-done is the list's job, never the grid's. The
   selected day's detail is one list, Done first then Ready, a status badge
   per row. Verdict groupings, drift, and the rollup stay stored, not
   rendered, pending post-prototype evaluation. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DayProgress = { done: string[]; ready: string[] };

function heatClass(count: number): string {
  if (count >= 5) return "h4";
  if (count >= 3) return "h3";
  if (count === 2) return "h2";
  if (count === 1) return "h1";
  return "";
}

/* one grammar for a day's summary: the day head and cell labels share it */
function daySummary(done: number, ready: number): string {
  if (done + ready === 0) return "Nothing yet";
  return [done ? `${done} done` : "", ready ? `${ready} ready` : ""].filter(Boolean).join(", ");
}

export function Progress({ state, onOpenTask }: { state: AppState; onOpenTask: (id: string) => void }) {
  const { tasks, projects } = useBootstrap(state);
  /* null = not loaded: the grid stands as breathing skeleton cells until
     the day counts land (the r4.1 async-loading grammar) */
  const [progress, setProgress] = useState<Record<string, DayProgress> | null>(null);
  const [selected, setSelected] = useState(today());
  const loading = progress === null;

  const refresh = () => state.client.progress().then((p) => setProgress(p.days));
  useEffect(() => {
    void refresh();
    return state.subscribe(() => void refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 26 weeks of days, ending with the current week (Sun-Sat columns) */
  const days = useMemo(() => {
    const start = addDays(weekStart(today()), -25 * 7);
    const out: string[] = [];
    for (let i = 0; i < 26 * 7; i++) out.push(addDays(start, i));
    return out;
  }, []);

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let last = -1;
    days.forEach((day, i) => {
      if (i % 7 !== 0) return;
      const m = new Date(day + "T00:00").getMonth();
      if (m !== last) {
        labels.push({ col: i / 7 + 1, label: MONTHS[m] });
        last = m;
      }
    });
    return labels;
  }, [days]);

  const td = today();
  const lookup = (ids: string[]) =>
    ids.map((id) => tasks.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  const doneTasks = lookup(progress?.[selected]?.done ?? []);
  const readyTasks = lookup(progress?.[selected]?.ready ?? []);
  /* Done first, then Ready; the badge carries the day's standing for the row */
  const rows = [
    ...doneTasks.map((task) => ({ task, as: "done" as const })),
    ...readyTasks.map((task) => ({ task, as: "ready" as const }))
  ];

  return (
    <div className="content">
      <div className="view-head">
        <h3>Progress</h3>
      </div>
      <div className="heat" aria-busy={loading || undefined}>
        <div className="heat-months">
          {monthLabels.map((m) => (
            <span key={m.col} style={{ gridColumnStart: m.col }}>{m.label}</span>
          ))}
        </div>
        <div className="heat-body">
          <div className="heat-days">
            <span style={{ gridRow: 2 }}>Mon</span>
            <span style={{ gridRow: 4 }}>Wed</span>
            <span style={{ gridRow: 6 }}>Fri</span>
          </div>
          <div className="heat-grid">
            {days.map((day) => {
              /* shape-matched loading: the same cell, breathing */
              if (loading) return <span key={day} className="heat-cell skel" aria-hidden="true" />;
              const p = progress[day];
              const count = p ? p.done.length + p.ready.length : 0;
              if (day > td) {
                return <button key={day} type="button" className="heat-cell future" tabIndex={-1} aria-hidden="true" />;
              }
              const label = `${fmtShort(day)} — ${daySummary(p?.done.length ?? 0, p?.ready.length ?? 0)}`;
              const cls = ["heat-cell", heatClass(count), day === selected ? "selected" : ""].filter(Boolean).join(" ");
              return (
                <button
                  key={day}
                  type="button"
                  className={cls}
                  title={label}
                  aria-label={label}
                  onClick={() => setSelected(day)}
                />
              );
            })}
          </div>
        </div>
        <div className="heat-foot">
          <span>Less</span>
          <span className="heat-cell" />
          <span className="heat-cell h1" />
          <span className="heat-cell h2" />
          <span className="heat-cell h3" />
          <span className="heat-cell h4" />
          <span>More</span>
        </div>
      </div>
      <div className="day-head">
        <span className="lbl">{fmtDayLong(selected)}</span>
        <span className="count">
          {loading
            ? <span className="skel skel-text" style={{ width: "7rem" }} />
            : daySummary(doneTasks.length, readyTasks.length)}
        </span>
      </div>
      {!loading && rows.length > 0 && (
        <div className="list">
          {rows.map(({ task, as }) => (
            <button key={task.id} type="button" className="list-row" onClick={() => onOpenTask(task.id)}>
              <ProjectPill name={projectName(projects, task.projectId)} />
              <span className="title">{task.title}</span>
              <StatusBadge status={as} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
