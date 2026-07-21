import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type ReactNode } from "react";

/* The shadcn/ui toggle group (D31) carrying the ruled physical-switch
   look (.seg): gray track, flat contrast thumb, no shadow — the active
   state keys off Radix data-state, not a hand-managed class. type is
   always "single" here: the toggle is a mode control. */
export function ToggleGroup({ value, onValueChange, children, ariaLabel }: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      className="seg"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => {
        if (v) onValueChange(v); /* a re-click never empties the mode */
      }}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleGroupItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <ToggleGroupPrimitive.Item className="btn btn-small" value={value}>
      {children}
    </ToggleGroupPrimitive.Item>
  );
}
