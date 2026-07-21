import { useRef, useState } from "react";
import { addDays, fmtDay, fmtWeek, today } from "../lib/dates";
import { Icon } from "./Icons";
import { Calendar } from "./ui/calendar";
import { Popover } from "./ui/popover";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Button } from "./ui/button";

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
      <ToggleGroup value={mode} onValueChange={(v) => onMode(v as CalMode)} ariaLabel="Time scope">
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="day">Day</ToggleGroupItem>
      </ToggleGroup>
      <Button className="jump" variant="quiet" size="small" onClick={() => onAnchor(today())}>
        {mode === "day" ? "Today" : "This week"}
      </Button>
      <Button variant="quiet" size="smallIcon" aria-label={mode === "day" ? "Previous day" : "Previous week"} onClick={() => onAnchor(addDays(anchor, -step))}>
        <Icon name="chevl" />
      </Button>
      <Button ref={pickerRef} className="picker fixed" variant="secondary" size="small" onClick={() => setOpen(!open)}>
        <Icon name="calendar" />
        <span className="lbl">{mode === "day" ? fmtDay(anchor) : fmtWeek(anchor)}</span>
        <svg className="icon" style={{ width: 10, height: 10 }} aria-hidden="true"><use href="#i-caret" /></svg>
      </Button>
      {open && (
        <Popover anchorRef={pickerRef} align="end" onClose={() => setOpen(false)}>
          <Calendar mode={mode} anchor={anchor} onPick={(d) => { onAnchor(d); setOpen(false); }} />
        </Popover>
      )}
      <Button variant="quiet" size="smallIcon" aria-label={mode === "day" ? "Next day" : "Next week"} onClick={() => onAnchor(addDays(anchor, step))}>
        <Icon name="chevr" />
      </Button>
    </>
  );
}
