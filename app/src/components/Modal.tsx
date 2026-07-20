import { useEffect, type ReactNode } from "react";

/* Modal chrome: the wrapper carries the --scrim dim (dogfood r3,
   superseding the r1 no-scrim ruling) and closes on outside click; Esc
   closes; the panel floats on --shadow-float, dead center both axes
   (dogfood r2). */
export function ModalWrap({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dm-wrap"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
