import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Icon } from "../Icons";

/* The one checkbox home (D31, review R1 — three hand-rolled variants
   collapsed). All three forms render the ruled .cbx grammar: 16px round,
   gray-700 border, brand fill + brand-ink check when checked, the drawn
   8x2 dash for mixed. Which form a call site uses is dictated by HTML:

   - Checkbox: the real control (Radix, renders a button with
     role=checkbox + aria-checked) — use it anywhere the checkbox is its
     own interactive element.
   - RowCheckbox: a span with role=checkbox and the keyboard grammar —
     for checkboxes living INSIDE a clickable row that is itself a
     button (backlog tree rows, inbox card headers); a nested button
     would be invalid HTML, which is why the span form exists.
   - CheckMark: display-only (aria-hidden) — for rows where the whole
     row carries the action and the mark only shows state (connect
     modal's session and app rows, select-all controls). */

export function Checkbox({ checked, mixed = false, disabled, ariaLabel, onCheckedChange }: {
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onCheckedChange: () => void;
}) {
  return (
    <CheckboxPrimitive.Root
      className={checked ? "cbx checked" : mixed ? "cbx mixed" : "cbx"}
      checked={mixed ? "indeterminate" : checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={onCheckedChange}
    >
      <CheckboxPrimitive.Indicator>
        {mixed ? <span className="dash" /> : <Icon name="check" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RowCheckbox({ checked, mixed = false, ariaLabel, onToggle }: {
  checked: boolean;
  mixed?: boolean; /* header select-all only: some-but-not-all visible rows */
  ariaLabel?: string;
  onToggle: () => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={ariaLabel}
      tabIndex={0}
      className={checked ? "cbx checked" : mixed ? "cbx mixed" : "cbx"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      {checked ? <Icon name="check" /> : mixed ? <span className="dash" /> : null}
    </span>
  );
}

export function CheckMark({ all, some = false }: { all: boolean; some?: boolean }) {
  return (
    <span className={all ? "cbx checked" : some ? "cbx mixed" : "cbx"} aria-hidden="true">
      {all ? <Icon name="check" /> : some ? <span className="dash" /> : null}
    </span>
  );
}
