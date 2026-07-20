import { useEffect, useRef, useState } from "react";
import { onDemoNotice } from "../lib/demo/notice";
import { Icon } from "./Icons";

/* Demo-notice toast (story 12): the deployed demo's answer to clicks
   whose destination lives on the local machine. One at a time,
   bottom-center, auto-dismissed; a new notice replaces the last. No
   entrance motion — liveness stays the only animated thing. Mounted by
   the shell in demo mode only. */

const DISMISS_MS = 4000;

export function DemoNotice() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const off = onDemoNotice((next) => {
      setText(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setText(null), DISMISS_MS);
    });
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, []);

  if (!text) return null;
  return (
    <div className="demo-toast" role="status">
      <Icon name="info" />
      {text}
    </div>
  );
}
