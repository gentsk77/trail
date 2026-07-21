import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/* The shadcn/ui badge carrying the two ruled small-carrier grammars
   (D31): the status badge (pill + dot + sentence-case word; never
   button-shaped, never a click target) and the chip (mono metadata
   carrier). shadcn's default variants are replaced by the ruled set —
   status hues are rationed by the status grammar, and no destructive
   variant exists. */
const badgeVariants = cva("", {
  variants: {
    variant: {
      planned: "badge badge-planned",
      running: "badge badge-running",
      waiting: "badge badge-waiting",
      ready: "badge badge-ready",
      done: "badge badge-done",
      shelved: "badge badge-shelved",
      chip: "chip"
    }
  }
});

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
