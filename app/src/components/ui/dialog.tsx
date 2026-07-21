import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type ReactNode } from "react";

/* The shadcn/ui dialog on Trail chrome (D31). Radix owns the focus trap,
   focus return, Esc layering (top layer only, nested dialogs and popovers
   cooperate), and the body scroll lock — adopting the a11y D19.2 cut from
   v0. The ruled grammar is unchanged: the wrapper carries the --scrim dim
   and dead-center placement (.dm-wrap), outside click closes through it,
   and the panel is whatever .dm markup the caller renders. `label` is the
   dialog's accessible name (visually hidden; the visible title lives in
   the caller's .dm-head). */
export function ModalWrap({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="dm-wrap"
          aria-describedby={undefined}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
