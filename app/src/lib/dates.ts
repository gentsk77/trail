/* Local-date helpers. Tasks carry YYYY-MM-DD; everything renders in the
   operator's local time. */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDay(new Date());
}

export function fromDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = fromDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/* Week runs Sunday-Saturday, as in the mock's calendar. */
export function weekStart(day: string): string {
  const d = fromDay(day);
  d.setDate(d.getDate() - d.getDay());
  return toDay(d);
}

export function inWeek(day: string, anchor: string): boolean {
  const start = weekStart(anchor);
  return day >= start && day <= addDays(start, 6);
}

/* "Wed, Jul 15" */
export function fmtDay(day: string): string {
  const d = fromDay(day);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

/* "Week of Jul 12" */
export function fmtWeek(day: string): string {
  const d = fromDay(weekStart(day));
  return `Week of ${MON[d.getMonth()]} ${d.getDate()}`;
}

/* "July 2026" */
export function fmtMonth(d: Date): string {
  const full = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${full[d.getMonth()]} ${d.getFullYear()}`;
}

/* "Wednesday, Jul 15" for the Progress day head */
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function fmtDayLong(day: string): string {
  const d = fromDay(day);
  return `${DOW_FULL[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

/* "Jul 15" for heat month labels + day list */
export function fmtShort(day: string): string {
  const d = fromDay(day);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

/* "1h 04m" / "26m" */
export function durShort(fromIso: string, toIso: string): string {
  const mins = Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/* timeline stamp: "10:04" today, "Jul 14 18:30" otherwise (as in the mock) */
export function fmtTs(iso: string): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return toDay(d) === today() ? hm : `${MON[d.getMonth()]} ${d.getDate()} ${hm}`;
}
