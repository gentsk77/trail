import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/* The shadcn/ui button carrying the Controls law (D31): heights 36/30,
   label-role type, ramp hovers, --brand-hover on primary, disabled by
   color never opacity, no elevation shadow, no destructive hue — the
   .btn class family in app.css is the rendered style, so the component
   and the law share one home. shadcn's default variants (ring focus,
   opacity disabled, shadow-xs, h-8 small) are overridden by ruling. */
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      none: "" /* the bare .btn frame (segmented items, unstyled carriers) */,
      primary: "btn-primary",
      secondary: "btn-secondary",
      quiet: "btn-quiet"
    },
    size: {
      default: "",
      small: "btn-small",
      icon: "btn-icon",
      smallIcon: "btn-small btn-icon"
    }
  },
  defaultVariants: { variant: "none", size: "default" }
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
