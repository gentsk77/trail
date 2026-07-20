import type { Project } from "../lib/types";
import { Icon } from "./Icons";

/* Projects are first-class (D18): the pill shows the project's editable
   name, resolved by id from the bootstrap payload. */
export function projectName(projects: Project[], id?: string): string | undefined {
  if (!id) return undefined;
  return projects.find((p) => p.id === id)?.name;
}

export function ProjectPill({ name }: { name?: string }) {
  if (!name) return null;
  /* long names cap + ellipsize; the full name rides the native tooltip,
     same affordance task titles use (r1B item 2) */
  return (
    <span className="chip" title={name}>
      <Icon name="folder" />
      <span className="lbl">{name}</span>
    </span>
  );
}
