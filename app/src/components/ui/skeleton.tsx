import { type CSSProperties } from "react";
import { cn } from "../../lib/utils";

/* The shadcn/ui skeleton on the ruled .skel grammar (dogfood r4.1):
   shape-matched placeholders breathing on --duration-live — loading is
   genuinely live, so it may move; settled content never pulses. */
export function Skeleton({ className, style, text = false, circle = false }: {
  className?: string;
  style?: CSSProperties;
  text?: boolean;
  circle?: boolean;
}) {
  return <span className={cn("skel", text && "skel-text", circle && "skel-circle", className)} style={style} aria-hidden="true" />;
}
