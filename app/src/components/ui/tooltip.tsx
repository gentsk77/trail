import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ReactNode } from "react";

/* The shadcn/ui tooltip (D31), replacing the rail's CSS [data-tip]
   micro-popovers. The ruled grammar holds: a 200ms beat in, gone at once
   on leave (no exit animation), caption type on background-2 with the
   gray-300 border and float shadow (.tip), no arrow. Portaling through
   Radix retires the z-index 30 literal. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tip({ label, side = "right", children }: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tip" side={side} sideOffset={8}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
