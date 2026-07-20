import type { Artifact } from "./types";

/* Artifact destinations (D17 r3–r4): where an artifact opens is a rule,
   not a guess. One map, one home — the Inbox tiles, the task modal's
   art-rows, and the sidecar's /api/open all consult it; no surface
   hardcodes a destination. Per-type overrides are post-v0.

     session                     -> terminal (resume: wt -d <dir> claude --resume <id>)
     link (pr, commit) + html    -> browser
     image (png, jpg, svg)       -> viewer (a look, not an editor tab)
     everything else (md, code)  -> editor (VS Code in v0)                */

export type Destination = "terminal" | "browser" | "viewer" | "editor";

const BROWSER_EXT = /\.html?$/i;
const IMAGE_EXT = /\.(png|jpe?g|svg)$/i; /* the ruled set (r4) — nothing more */

export function destinationFor(kind: Artifact["kind"], pathOrHref?: string): Destination {
  if (kind === "session") return "terminal";
  if (kind === "pr" || kind === "commit") return "browser";
  const target = pathOrHref ?? "";
  if (/^https?:\/\//i.test(target) || BROWSER_EXT.test(target)) return "browser";
  if (IMAGE_EXT.test(target)) return "viewer";
  return "editor";
}

/* Commit artifacts carry no URL of their own (dogfood r2): the open route
   resolves the project's git remote into a browsable commit URL. ssh and
   .git forms normalize to https; a remote that is not a URL (a local path)
   resolves to nothing and the route falls back to git show in a terminal. */
export function commitUrl(remote: string, sha: string): string | undefined {
  let base = remote.trim().replace(/\.git$/, "");
  if (!base || !sha) return undefined;
  const ssh = base.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/);
  if (ssh) base = `https://${ssh[1]}/${ssh[2]}`;
  if (!/^https?:\/\//.test(base)) return undefined;
  return `${base}/commit/${sha}`;
}

/* How a file artifact's tile previews (D17): images render as images,
   html renders in a sandboxed frame, everything else shows its opening
   lines as text — a real render or a kind icon, never a fake. */
export function previewKindFor(filePath?: string): "image" | "html" | "text" {
  const target = filePath ?? "";
  if (IMAGE_EXT.test(target)) return "image";
  if (BROWSER_EXT.test(target)) return "html";
  return "text";
}
