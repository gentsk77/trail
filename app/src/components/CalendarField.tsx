import { useState } from "react";
import { fmtDay, fmtMonth, fromDay, today, toDay, weekStart } from "../lib/dates";
import { Icon } from "./Icons";
import { Button } from "./ui/button";

/* Day-pick popover for the modal's Date field; same calendar grammar the
   Calendar control section owns. */
export function CalendarPopoverField({ anchor, onPick }: { anchor?: string; onPick: (day: string) => void }) {
  const base = anchor ?? today();
  const [monthDate, setMonthDate] = useState(() => {
    const d = fromDay(base);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const gridStart = fromDay(weekStart(toDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1))));
  const cells: { day: string; muted: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push({ day: toDay(d), muted: d.getMonth() !== monthDate.getMonth() });
  }
  while (cells.length > 7 && cells.slice(-7).every((c) => c.muted)) cells.splice(-7);

  const td = today();
  return (
    <div className="cal">
      <div className="cal-head">
        <span className="month">{fmtMonth(monthDate)}</span>
        <span className="nav">
          <Button variant="quiet" size="smallIcon" aria-label="Previous month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}><Icon name="chevl" /></Button>
          <Button variant="quiet" size="smallIcon" aria-label="Next month" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}><Icon name="chevr" /></Button>
        </span>
      </div>
      <div className="cal-grid">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="dow">{d}</span>)}
        {cells.map(({ day, muted }) => {
          const cls = ["day"];
          if (muted) cls.push("muted");
          if (day === td) cls.push("today");
          if (day === anchor) cls.push("selected");
          return (
            <button key={day} type="button" className={cls.join(" ")} onClick={() => onPick(day)}>
              {fromDay(day).getDate()}
            </button>
          );
        })}
      </div>
      <div className="cal-foot">{anchor ? fmtDay(anchor) : "No date"}</div>
    </div>
  );
}
