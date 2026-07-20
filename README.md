# Trail

Trail is an agent-native personal task tracker. Instead of asking you to log what you did, it reconciles your stated intent against the evidence your tools already record — agent session transcripts, git history, calendar.

## Why

When execution moves into AI agent sessions, two things break. **Closure**: at the end of the day, "what did I actually get done?" is unanswerable from memory, because the evidence lives in transcripts, commits, and PR threads you never typed. And every mainstream tracker compounds the problem by assuming the human is the write path for status — double-entry bookkeeping against work that is already fully recorded elsewhere, which is why personal trackers rot within days of adoption. The truth already exists in the substrate; Trail reads it.

The full argument, with research citations, is in [thesis.md](thesis.md).

## How it works

- **Intent** — a small tree of standing objectives, with concrete dated tasks linked to the objectives they serve. "Today" and "this week" are views over that structure, not separate data levels.
- **Evidence** — read-only ingest of the substrate: agent session stores and git across watched repos. Trail observes; it never mutates.
- **Reconciliation** — at day and week boundaries the plan is diffed against the evidence. Evidence moves tasks forward automatically; only the operator's own move sets Done, so Done is never a claim.
- **Dispatch** — any task can be handed to an agent as a pre-contexted session: the task, its objective chain, and the lessons accumulated from its family travel with it.

## Running it

```sh
cd app
npm install
npm run dev        # web + API against the live local substrate
npm run demo       # seeded demo mode, no local data needed
npm test           # vitest suite
npm run typecheck
```

## Design system

[design/design-system.html](design/design-system.html) is the source of truth for visual law — open it in a browser. [design/design.md](design/design.md) is generated from it for agent consumption and is never hand-edited:

```sh
python scripts/generate_design_md.py          # regenerate after editing the sheet
python scripts/generate_design_md.py --check  # exit 1 if design.md is stale
```

## Decision record

[docs/decisions.md](docs/decisions.md) is the append-only, D-numbered log of product rulings — status model, view set, visual identity, dogfood batches. Code comments cite these numbers (D8, D24.1, …); the log is where they resolve.

## Status

A working personal prototype, N=1 by design: built by and for a single agent-native operator. Substrate ingest is strictly read-only, and everything Trail writes back toward the substrate (procedure patches, dispatched sessions) is propose-only — the human ratifies.
