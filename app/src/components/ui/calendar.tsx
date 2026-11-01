import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { addDays, fmtDay, fmtMonth, fmtWeek, fromDay, inWeek, today, toDay, weekStart } from "../../lib/dates";
import { Icon } from "../Icons";

/* The shadcn/ui calendar (react-day-picker) carrying the ruled month
   grid (D31, review R2 — the hand-rolled 42-cell grid lived twice, in
   the control and the field). One grid, both consumers. The ruled
   grammar holds: caption-type cells, muted adjacent-month days, today a
   quiet gray-500 outline (selection is blue's job), day mode a brand
   fill, week mode the brand-soft band rounded at the ends with the
   anchor day brand, only the month's own weeks render, and the footer
   restates the selection in words. lucide chevrons are replaced by the
   library's own (D22). */
export function Calendar({ mode = "day", anchor, onPick }: {
  mode?: "day" | "week";
  anchor?: string;
  onPick: (day: string) => void;
}) {
  const base = anchor ?? today();
  const [month, setMonth] = useState(() => {
    const d = fromDay(base);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const anchorWeekFirst = anchor ? weekStart(anchor) : undefined;
  const week = mode === "week" && anchor;

  return (
    <div className="cal">
      <DayPicker
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={mode === "day" && anchor ? fromDay(anchor) : undefined}
        onDayClick={(d) => onPick(toDay(d))}
        showOutsideDays
        modifiers={{
          inWeek: (d) => !!week && inWeek(toDay(d), anchor),
          weekFirst: (d) => !!week && toDay(d) === anchorWeekFirst,
          weekLast: (d) => !!week && toDay(d) === addDays(anchorWeekFirst ?? toDay(d), 6),
          anchor: (d) => !!week && toDay(d) === anchor
        }}
        modifiersClassNames={{ inWeek: "in-week", weekFirst: "first", weekLast: "last", anchor: "anchor" }}
        formatters={{
          formatWeekdayName: (d) => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()],
          formatCaption: (d) => fmtMonth(d)
        }}
        components={{
          Chevron: ({ orientation }) => <Icon name={orientation === "left" ? "chevl" : "chevr"} />
        }}
        classNames={{
          months: "cal-months",
          month_caption: "cal-caption",
          caption_label: "month",
          nav: "cal-nav",
          button_previous: "btn btn-quiet btn-small btn-icon",
          button_next: "btn btn-quiet btn-small btn-icon",
          month_grid: "cal-table",
          weekdays: "cal-weekdays",
          weekday: "dow",
          day: "cal-day",
          day_button: "day",
          selected: "selected",
          today: "cal-today",
          outside: "muted"
        }}
      />
      <div className="cal-foot">
        {mode === "week" ? (anchor ? fmtWeek(anchor) : "No week") : anchor ? fmtDay(anchor) : "No date"}
      </div>
    </div>
  );
}
