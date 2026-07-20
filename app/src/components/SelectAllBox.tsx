import { Icon } from "./Icons";

/* The select-all control's own checkbox (dogfood r3): every
   select/deselect-all action shows its state — checked = all, the drawn
   dash = some (the bulk-header mixed grammar), empty = none. */
export function SelectAllBox({ all, some }: { all: boolean; some: boolean }) {
  return (
    <span className={all ? "cbx checked" : some ? "cbx mixed" : "cbx"} aria-hidden="true">
      {all ? <Icon name="check" /> : some ? <span className="dash" /> : null}
    </span>
  );
}
