import { describe, expect, it } from "vitest";
import { parseInline, stripBlockMarkers } from "../src/lib/md";

/* the inline-markdown parser behind the Inbox waiting excerpt (dogfood r2) */

describe("parseInline", () => {
  it("renders bold, code, and italic as segments", () => {
    expect(parseInline("New table has **Surface** column")).toEqual([
      { kind: "text", text: "New table has " },
      { kind: "bold", text: "Surface" },
      { kind: "text", text: " column" }
    ]);
    expect(parseInline("recut committed (`6a4b712`).")).toEqual([
      { kind: "text", text: "recut committed (" },
      { kind: "code", text: "6a4b712" },
      { kind: "text", text: ")." }
    ]);
    expect(parseInline("_deterministic_ Waiting")).toEqual([
      { kind: "italic", text: "deterministic" },
      { kind: "text", text: " Waiting" }
    ]);
  });

  it("collapses links and images to their text", () => {
    expect(parseInline("see [the PR](https://x.test/pr/7) for detail")).toEqual([
      { kind: "text", text: "see " },
      { kind: "text", text: "the PR" },
      { kind: "text", text: " for detail" }
    ]);
    expect(parseInline("![chart](assets/img/a.png)")).toEqual([{ kind: "text", text: "chart" }]);
  });

  it("leaves lone asterisks and underscores alone", () => {
    expect(parseInline("2 * 3 and snake_case stay text")).toEqual([
      { kind: "text", text: "2 * 3 and snake_case stay text" }
    ]);
  });
});

describe("stripBlockMarkers", () => {
  it("strips heading, quote, list, and ordered markers", () => {
    expect(stripBlockMarkers("## Heading")).toBe("Heading");
    expect(stripBlockMarkers("> quoted")).toBe("quoted");
    expect(stripBlockMarkers("- item")).toBe("item");
    expect(stripBlockMarkers("2. step")).toBe("step");
  });

  it("keeps ordinary text untouched", () => {
    expect(stripBlockMarkers("plain sentence - with a dash")).toBe("plain sentence - with a dash");
  });
});
