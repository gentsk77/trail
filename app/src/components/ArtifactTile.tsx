import { useEffect, useState } from "react";
import type { ArtifactPreview, TrailClient } from "../lib/api";
import { destinationFor } from "../lib/destinations";
import type { Artifact } from "../lib/types";
import { Icon, type IconName } from "./Icons";

/* Artifact thumbnails (D17, amends D8 for the Inbox surface): preview
   tiles for previewable files — a real render of the file's own bytes —
   and kind-icon tiles for commits, PRs, and sessions. Never a fake
   preview: no source, icon tile. Click opens per the destination map;
   hover is the brand border + the open-link glyph (r5/r6). */

export function artifactIcon(artifact: Artifact): IconName {
  if (artifact.kind === "pr") return "pr";
  if (artifact.kind === "commit") return "commit";
  if (artifact.kind === "session") return "session";
  const destination = destinationFor(artifact.kind, artifact.path ?? artifact.href);
  return destination === "viewer" ? "image" : destination === "browser" ? "link" : "pencil";
}

export function ArtifactTile({ artifact, client, onOpen }: {
  artifact: Artifact;
  client: TrailClient;
  onOpen: () => void;
}) {
  const [preview, setPreview] = useState<ArtifactPreview>(null);

  useEffect(() => {
    let stale = false;
    if (artifact.kind === "file") {
      client.artifactPreview(artifact).then((p) => {
        if (!stale) setPreview(p);
      }).catch(() => {});
    }
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.path, artifact.kind]);

  return (
    <button type="button" className="thumb" title={artifact.label} onClick={onOpen}>
      <span className="prev">
        {preview?.kind === "image" ? (
          <img src={preview.url} alt="" />
        ) : preview?.kind === "html" ? (
          /* sandboxed (no scripts), inert, scaled-down real render */
          <iframe src={preview.url} sandbox="" tabIndex={-1} title={artifact.label} aria-hidden="true" />
        ) : preview?.kind === "text" ? (
          <span className="txt" aria-hidden="true">{preview.text}</span>
        ) : (
          <Icon name={artifactIcon(artifact)} />
        )}
      </span>
      <span className="foot">
        <Icon name="link" className="go" />
        <span className="name">{artifact.label}</span>
      </span>
    </button>
  );
}
