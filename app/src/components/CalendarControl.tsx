import { useRef, useState } from "react";
import { addDays, fmtDay, fmtMonth, fmtWeek, fromDay, inWeek, toDay, today, weekStart } from "../lib/dates";
import { Icon } from "./Icons";
import { Popover } from "./ui/popover";

export type CalMode = "day" | "week";

/* The one cluster owning time scope: Week/Day physical toggle, fixed-width
   jump + picker (no reflow across modes/steps), steppers, popover. */

export function CalendarControl({ mode, anchor, onMode, onAnchor }: {
  mode: CalMode;
  anchor: string;
  onMode: (m: CalMode) => void;
  onAnchor: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLButtonElement>(null);

  const step = mode === "day" ? 1 : 7;
  return (
    <>
      <span className="seg">
        <button type="button" className={mode === "week" ? "btn btn-small active" : "btn btn-small"} onClick={() => onMode("week")}>Week</button>
        <button type="button" className={mode === "day" ? "btn btn-small active" : "btn btn-small"} onClick={() => onMode("day")}>Day</button>
      </span>
      <button type="button" className="btn btn-quiet btn-small jump" onClick={() => onAnchor(today())}>
        {mode === "day" ? "Today" : "This week"}
      </button>
      <button type="button" className="btn btn-quiet btn-small btn-icon" aria-label={mode === "day" ? "Previous day" : "Previous week"} onClick={() => onAnchor(addDays(anchor, -step))}>
        <Icon name="chevl" />
      </button>
      <button type="button" ref={pickerRef} className="btn btn-secondary btn-small picker fixed" onClick={() => setOpen(!open)}>
        <Icon name="calendar" />
        <span className="lbl">{mode === "day" ? fmtDay(anchor) : fmtWeek(anchor)}</span>
        <svg className="icon" style={{ width: 10, height: 10 }} aria-hidden="true"><use href="#i-caret" /></svg>
      </button>
      {open && (
        <Popover anchorRef={pickerRef} align="end" onClose={() => setOpen(false)}>
          <CalendarPopover mode={mode} anchor={anchor} onPick={(d) => { onAnchor(d); setOpen(false); }} />
        </Popover>
      )}
      <button type="button" className="btn btn-quiet btn-small btn-icon" aria-label={mode === "day" ? "Next day" : "Next week"} onClick={() => onAnchor(addDays(anchor, step))}>
        <Icon name="chevr" />
      </button>
    </>
  );
}

function CalendarPopover({ mode, anchor, onPick }: { mode: CalMode; anchor: string; onPick: (day: string) => void }) {
  const [monthDate, setMonthDate] = useState(() => {
    const d = fromDay(anchor);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = fromDay(weekStart(toDay(first)));
  const cells: { day: string; muted: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push({ day: toDay(d), muted: d.getMonth() !== monthDate.getMonth() });
  }
  // trim trailing all-muted week rows, as the mock renders only the month's weeks
  while (cells.length > 7 && cells.slice(-7).every((c) => c.muted)) cells.splice(-7);

  const td = today();
  const anchorWeekFirst = weekStart(anchor);
  const anchorWeekLast = addDays(anchorWeekFirst, 6);

  return (
    <div className="cal">
      <div className="cal-head">
        <span className="month">{fmtMonth(monthDate)}</span>
        <span className="nav">
          <button type="button" className="btn btn-quiet btn-small btn-icon" aria-label="Previous month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}><Icon name="chevl" /></button>
          <button type="button" className="btn btn-quiet btn-small btn-icon" aria-label="Next month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}><Icon name="chevr" /></button>
        </span>
      </div>
      <div className="cal-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="dow">{d}</span>)}
        {cells.map(({ day, muted }) => {
          const cls = ["day"];
          if (muted) cls.push("muted");
          if (day === td) cls.push("today");
          if (mode === "day") {
            if (day === anchor) cls.push("selected");
          } else if (inWeek(day, anchor)) {
            cls.push("in-week");
            if (day === anchorWeekFirst) cls.push("first");
            if (day === anchorWeekLast) cls.push("last");
            if (day === anchor) cls.push("selected");
          }
          return (
            <button key={day} type="button" className={cls.join(" ")} onClick={() => onPick(day)}>
              {fromDay(day).getDate()}
            </button>
          );
        })}
      </div>
      <div className="cal-foot">{mode === "day" ? fmtDay(anchor) : fmtWeek(anchor)}</div>
    </div>
  );
}
