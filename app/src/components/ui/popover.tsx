import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useRef, type ReactNode, type RefObject } from "react";

/* The one popover primitive, now the shadcn/ui popover (D31): every float
   panel still renders through this single component (the sheet's Overlays
   law outranks shadcn's popover/dropdown-menu taxonomy, so there is no
   second menu primitive). Radix carries the ruled contract natively:
   portal to body, below-the-trigger start-aligned placement with the
   space-2 gap, collision flip (amends the letter of the old
   above-has-more rule), re-anchoring on outside scroll and resize, and
   Esc dismissing only the top layer. Kept by hand:
   - mounted = open; the call site owns trigger state and content;
   - a pointer-down on the anchor never counts as outside (the trigger's
     own click handler owns the toggle);
   - Esc hands focus back to the trigger; an outside click leaves focus
     where the user clicked (C3);
   - height caps at min(20rem, available) in CSS via the Radix var. */
export function Popover({ anchorRef, onClose, align = "start", children }: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const escaped = useRef(false);
  return (
    <PopoverPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverPrimitive.Anchor virtualRef={anchorRef as RefObject<HTMLElement>} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="popover"
          side="bottom"
          align={align}
          sideOffset={8}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          onEscapeKeyDown={() => {
            escaped.current = true;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (escaped.current) {
              escaped.current = false;
              anchorRef.current?.focus();
            }
          }}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
