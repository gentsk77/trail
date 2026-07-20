import { describe, expect, it } from "vitest";
import { commitUrl, destinationFor } from "../src/lib/destinations";

/* The kind→destination map (D17 r3–r4): one module, every surface
   consults it. These cases are the ruling verbatim. */
describe("artifact destinations", () => {
  it("sessions resume in a terminal", () => {
    expect(destinationFor("session", "C:/store/s1.jsonl")).toBe("terminal");
    expect(destinationFor("session")).toBe("terminal");
  });

  it("links (PRs, commits) and html open in the browser", () => {
    expect(destinationFor("pr", "https://github.com/x/y/pull/1")).toBe("browser");
    expect(destinationFor("commit")).toBe("browser");
    expect(destinationFor("file", "D:/repo/tracker.html")).toBe("browser");
    expect(destinationFor("file", "D:/repo/page.HTM")).toBe("browser");
    expect(destinationFor("file", "https://example.com/report")).toBe("browser");
  });

  it("images (png, jpg, svg) open in the viewer", () => {
    expect(destinationFor("file", "D:/shots/board.png")).toBe("viewer");
    expect(destinationFor("file", "D:/shots/photo.JPEG")).toBe("viewer");
    expect(destinationFor("file", "D:/art/logo.svg")).toBe("viewer");
  });

  it("everything else (md, code, unknown) opens in the editor", () => {
    expect(destinationFor("file", "D:/repo/playbook.md")).toBe("editor");
    expect(destinationFor("file", "D:/repo/src/index.ts")).toBe("editor");
    expect(destinationFor("file", "D:/repo/Makefile")).toBe("editor");
    expect(destinationFor("file")).toBe("editor");
  });
});

/* commit URL resolution (dogfood r2): the remote normalizes to https or
   the route falls back to a terminal git show */
describe("commitUrl", () => {
  it("normalizes https and ssh remotes, dropping .git", () => {
    expect(commitUrl("https://github.com/org/repo.git", "6a4b712")).toBe("https://github.com/org/repo/commit/6a4b712");
    expect(commitUrl("git@github.com:org/repo.git", "6a4b712")).toBe("https://github.com/org/repo/commit/6a4b712");
    expect(commitUrl("ssh://git@gitlab.com/org/repo", "abc1234")).toBe("https://gitlab.com/org/repo/commit/abc1234");
  });

  it("refuses non-URL remotes and empty input", () => {
    expect(commitUrl("D:/repos/mirror", "6a4b712")).toBeUndefined();
    expect(commitUrl("", "6a4b712")).toBeUndefined();
    expect(commitUrl("https://github.com/org/repo", "")).toBeUndefined();
  });
});
