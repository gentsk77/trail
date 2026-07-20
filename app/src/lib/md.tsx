import type { ReactNode } from "react";

/* Inline markdown for agent-authored excerpts (dogfood r2): bold, italic,
   and inline code render as formatting; link and image syntax collapse to
   their text; heading, list, and quote markers strip. Block structure has
   no home in a three-line clamp, so lines stay lines and nothing more.
   Never HTML: the parser emits segments, the renderer emits elements. */

export interface MdSegment {
  kind: "text" | "bold" | "italic" | "code";
  text: string;
}

const INLINE = new RegExp(
  [
    "`([^`]+)`", // 1 code
    "\\*\\*([^*]+)\\*\\*", // 2 bold
    "__([^_]+)__", // 3 bold
    "\\*([^*\\s][^*]*)\\*", // 4 italic
    "_([^_\\s][^_]*)_", // 5 italic
    "!?\\[([^\\]]*)\\]\\(([^)]*)\\)" // 6 link/image -> its text
  ].join("|")
);

const KINDS: MdSegment["kind"][] = ["code", "bold", "bold", "italic", "italic", "text"];

export function parseInline(text: string): MdSegment[] {
  const out: MdSegment[] = [];
  const push = (kind: MdSegment["kind"], t: string) => {
    if (t) out.push({ kind, text: t });
  };
  let rest = text;
  for (;;) {
    const m = INLINE.exec(rest);
    if (!m) {
      push("text", rest);
      return out;
    }
    push("text", rest.slice(0, m.index));
    const group = m.slice(1).findIndex((g) => g !== undefined);
    push(KINDS[group], m[group + 1]);
    rest = rest.slice(m.index + m[0].length);
  }
}

/* leading heading/list/quote markers say structure, not content */
export function stripBlockMarkers(line: string): string {
  return line.replace(/^\s*(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/, "");
}

export function renderInlineMd(text: string): ReactNode[] {
  return text.split(/\r?\n/).flatMap((line, i) => {
    const segments = parseInline(stripBlockMarkers(line)).map((seg, j) => {
      const key = `${i}-${j}`;
      if (seg.kind === "bold") return <strong key={key}>{seg.text}</strong>;
      if (seg.kind === "italic") return <em key={key}>{seg.text}</em>;
      if (seg.kind === "code") return <code key={key}>{seg.text}</code>;
      return <span key={key}>{seg.text}</span>;
    });
    return i === 0 ? segments : [" ", ...segments];
  });
}
