#!/usr/bin/env python3
"""Generate design.md (agent-readable) from design-system.html (the source of truth).

The sheet is the one home for visual law; design.md is a generated
derivation for agents and quick citation, in the spirit of public
<site>/design.md conventions. Never hand-edit design.md: edit the
sheet, then rerun this script.

The parser reads the sheet's own lawful structure (the token block in
:root / [data-theme="dark"], and per-section h2.sec-title +
p.annotation + ul.spec). If the sheet stops following that structure,
this script failing is the correct signal.

Usage:
  python scripts/generate_design_md.py            regenerate design.md
  python scripts/generate_design_md.py --check    exit 1 if design.md is stale

Stdlib only.
"""

import re
import sys
from pathlib import Path

DESIGN_DIR = Path(__file__).resolve().parent.parent / "design"
SHEET = DESIGN_DIR / "design-system.html"
OUTPUT = DESIGN_DIR / "design.md"


def strip_tags(html: str) -> str:
    html = re.sub(r"<strong>(.*?)</strong>", r"**\1**", html, flags=re.DOTALL)
    html = re.sub(r"<code>(.*?)</code>", r"`\1`", html, flags=re.DOTALL)
    html = re.sub(r"<em>(.*?)</em>", r"*\1*", html, flags=re.DOTALL)
    html = re.sub(r"<[^>]+>", "", html)
    html = html.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return re.sub(r"\s+", " ", html).strip()


def parse_token_block(css: str) -> dict:
    """Return {token: (value, comment)} from one declaration block.

    A line may hold several declarations; a trailing comment is
    attached only when the line holds exactly one.
    """
    tokens = {}
    for line in css.splitlines():
        decls = re.findall(r"(--[\w-]+):\s*([^;]+);", line)
        comment_m = re.search(r"/\*\s*(.*?)\s*\*/", line)
        comment = comment_m.group(1) if comment_m and len(decls) == 1 else ""
        for name, value in decls:
            tokens[name] = (value.strip(), comment)
    return tokens


def extract_block(text: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{(.*?)\n  \}", text, re.DOTALL)
    return match.group(1) if match else ""


def parse_sections(html: str) -> list:
    """Return [(title, annotation, [spec items])] per sheet section."""
    sections = []
    for box in re.findall(r'<section class="box(?: wide)?">(.*?)</section>', html, re.DOTALL):
        title_m = re.search(r'<h2 class="sec-title">(.*?)</h2>', box, re.DOTALL)
        ann_m = re.search(r'<p class="annotation">(.*?)</p>', box, re.DOTALL)
        specs = []
        spec_m = re.search(r'<ul class="spec">(.*?)</ul>', box, re.DOTALL)
        if spec_m:
            specs = [strip_tags(li) for li in re.findall(r"<li>(.*?)</li>", spec_m.group(1), re.DOTALL)]
        if title_m:
            sections.append((strip_tags(title_m.group(1)), strip_tags(ann_m.group(1)) if ann_m else "", specs))
    return sections


def generate() -> str:
    html = SHEET.read_text(encoding="utf-8")
    light = parse_token_block(extract_block(html, ":root"))
    dark = parse_token_block(extract_block(html, '[data-theme="dark"]'))
    title_m = re.search(r"<title>(.*?)</title>", html)
    title = strip_tags(title_m.group(1)) if title_m else "design system"

    lines = [
        f"# {title}",
        "",
        "Generated from `design-system.html` by `scripts/generate_design_md.py`. Never hand-edit;",
        "the sheet is the source of truth, and this file exists so agents can read and cite the law",
        "without parsing HTML. Demos, exact component rendering, and conformance checks live in the",
        "sheet only.",
        "",
        "## Tokens",
        "",
        "| token | light | dark | note |",
        "|---|---|---|---|",
    ]
    for name, (value, comment) in light.items():
        dark_value = dark.get(name, ("", ""))[0]
        lines.append(f"| `{name}` | `{value}` | `{dark_value}` | {comment} |")
    for name, (value, comment) in dark.items():
        if name not in light:
            lines.append(f"| `{name}` | | `{value}` | {comment} |")

    for section_title, annotation, specs in parse_sections(html):
        lines += ["", f"## {section_title}", "", annotation]
        if specs:
            lines.append("")
            lines += [f"- {item}" for item in specs]

    return "\n".join(lines) + "\n"


def main() -> int:
    if not SHEET.is_file():
        print(f"sheet not found: {SHEET}")
        return 1
    content = generate()
    if "--check" in sys.argv:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.is_file() else ""
        if current != content:
            print("STALE: design.md does not match design-system.html. Run scripts/generate_design_md.py.")
            return 1
        print("OK: design.md is in sync with the sheet.")
        return 0
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
