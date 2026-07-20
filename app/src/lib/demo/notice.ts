/* Demo-notice bus (story 12 / R9): when a click's destination lives on
   the local machine, the demo client reports the gap here and the shell
   renders it as a toast — never a dead click, never a fake success.
   Demo-only wiring: the live client never imports this module, and the
   toast mounts only behind client.mode === "demo". */

type Listener = (text: string) => void;

const listeners = new Set<Listener>();

export function onDemoNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function demoNotice(text: string): void {
  for (const listener of listeners) listener(text);
}
