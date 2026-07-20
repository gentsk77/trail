import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/* The one popover primitive: every menu and date-picker panel renders
   through it (dogfood r1B, item 5). Behavior contract (benchmarked against
   Radix Popover / Floating UI):

   - Mounted = open; the call site owns trigger state and panel content.
   - Portal to document.body, positioned fixed from the trigger's viewport
     rect — opening a popover never reflows or adds scrollbars to ancestors.
   - Outside pointer-down and Escape dismiss; Escape dismisses only this
     layer (a menu inside a modal leaves the modal open) and returns focus
     to the trigger.
   - Placement: below the trigger, gap space-2, start-aligned by default;
     flips above when below can't hold the panel and above has more room;
     mirrors alignment then clamps at the left/right viewport edge.
   - Max height min(20rem, space on the chosen side); longer content
     scrolls inside the panel, never the page.
   - Re-anchors on any scroll outside the panel, window resize, and
     panel-content resize; scrolling inside the panel never re-places. */

const GAP = 8; /* space-2: trigger-to-panel gap, per the sheet's menu offset */
const MARGIN = 8; /* collision padding against the viewport */
const MAX_H = 320; /* 20rem cap, the Radix/Floating UI size-middleware benchmark */

export function Popover({ anchorRef, onClose, align = "start", children }: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Positioning: measure, choose a side, cap height, then pin. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;

    const place = () => {
      const r = anchor.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      /* un-capping for the measurement zeroes any child scroll position;
         save and restore around it */
      const scrollers = [...panel.children] as HTMLElement[];
      const scrollTops = scrollers.map((el) => el.scrollTop);
      panel.style.maxHeight = "";
      const naturalH = panel.offsetHeight;
      const w = panel.offsetWidth;

      const below = vh - r.bottom - GAP - MARGIN;
      const above = r.top - GAP - MARGIN;
      const flip = naturalH > below && above > below;
      panel.style.maxHeight = `${Math.max(Math.min(MAX_H, flip ? above : below), 0)}px`;
      const h = panel.offsetHeight;
      panel.style.top = `${flip ? r.top - GAP - h : r.bottom + GAP}px`;

      let left = align === "end" ? r.right - w : r.left;
      if (left + w > vw - MARGIN) left = r.right - w; /* mirror at the right edge */
      if (left < MARGIN) left = r.left; /* mirror back at the left edge */
      left = Math.min(Math.max(left, MARGIN), Math.max(vw - MARGIN - w, MARGIN));
      panel.style.left = `${left}px`;
      scrollers.forEach((el, i) => { el.scrollTop = scrollTops[i]; });
    };

    /* panel-internal scrolling never moves the anchor; re-placing on it
       fights the scroll (the measurement snaps content back to the top,
       making a long menu unscrollable) — only outside scrolls re-anchor */
    const onScroll = (e: Event) => {
      if (panel.contains(e.target as Node)) return;
      place();
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(panel);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorRef, align]);

  /* Dismissal: outside pointer-down closes; Escape closes the top layer
     only (capture + stopPropagation beats the modal's bubble listener)
     and hands focus back to the trigger. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, anchorRef]);

  return createPortal(
    <div className="popover" ref={panelRef}>
      {children}
    </div>,
    document.body
  );
}
