import { Toaster as SonnerToaster, toast } from "sonner";
import { Icon } from "../Icons";

/* The shadcn/ui toast (Sonner) carrying the ruled demo-notice grammar
   (D31): one at a time (a new notice replaces the last via the fixed
   id), bottom-center, auto-dismissed after 4s, the soft-inverse
   .demo-toast surface with the info glyph. Entrance motion is killed in
   CSS — the toast appears and leaves plainly; motion stays liveness's
   alone (the demo-declarations law outranks C2's overlay entrances). */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      visibleToasts={1}
      gap={0}
      offset={{ bottom: 24 /* space-6 off the edge */ }}
      toastOptions={{ unstyled: true, duration: 4000 }}
    />
  );
}

export function demoToast(text: string) {
  toast.custom(
    () => (
      <div className="demo-toast" role="status">
        <Icon name="info" />
        {text}
      </div>
    ),
    { id: "demo-notice", duration: 4000 }
  );
}
