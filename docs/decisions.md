# Decision record: Trail

Rulings, D-numbered, append-only. A ruling changes only through a new numbered decision that supersedes or amends it; the same change stamps the old entry with a one-line *Superseded by / Amended by DN* note under its heading and updates its index row. Those stamps are the only edits ever made to an old entry. An agent that finds reality contradicting a standing decision flags it with a recommendation; only the maintainer retires a decision.

Code comments cite these rulings by number (D8, D24.1, …); F- and R-numbers refer to the red-team findings and requirements of the PRD era this record grew up alongside.

## Index

| # | Ruling |
|---|---|
| D1 | PRD spine: thesis recentered on closure + compounding; MVP = closed day-loop; red-team fixes are requirements |
| D2 | Prototype data modes: live-local reads real substrate; deployed demo ships authored fictional seed (per D21) |
| D3 | Working name: Trail (provisional) |
| D4 | v0 focus: local session e2e; calendar cut from v0; stack ruling deferred until design complete |
| D5 | Session-only evidence: session store is v0's sole source; dispatch-born links; harvester replaces matcher |
| D6 | Compounding on the operator's clock: on-demand/scheduled audit, post-MVP; no hard-coded triggers |
| D7 | Intake cut: conversational capture (R2) demoted to P1; MVP intake = manual creation + session detection |
| D8 | Status model: six states, human-only Ready→Done, artifacts detail-only (Inbox thumbnails per D17); zero-maintenance reframed to auto-Ready |
| D9 | MVP view set: Backlog tree, Board, Task detail modal, Recap, Workspace (import home) |
| D10 | Visual identity: charcoal + electric-blue palette, Roboto, hue rationing, motion-as-liveness |
| D11 | Manual status moves unrestricted; sign-off action removed (verb returns on the Inbox per D17): Done is any manual operator move; automation still never sets Done |
| D12 | Progress condensed: heat grid + day list (ready+done per D15); verdict/drift/rollup surfacing deferred post-prototype; view names Dashboard/Backlog/Progress/Projects (+ Inbox per D17) |
| D13 | Prototype stack: Vite+React+TS SPA, Fastify sidecar, JSON store; gates tsc --noEmit + npm test; demo deploys static |
| D14 | Agent-app connect flow: import moves to Settings; one connect action imports projects + past sessions and watches future ones; sessions become tasks; Cowork cut (Projects view rework per D18) |
| D15 | Progress counts Ready alongside Done: heat depth = ready + done per day, day list renders both groups badged; same-day ready→done counts once as done |
| D16 | Task-modal editing: inline interaction, Save-gated commit (dirty-tracked fields, one updateTask); status alone stays immediate; dirty close discards |
| D17 | Inbox view: fifth destination, two-section attention queue (sign-off + waiting); artifact thumbnails with soft review checkboxes; "Sign off" returns as the review-surface verb |
| D18 | Projects becomes a management surface: card grid + edit modal; projects first-class (id, editable name, optional directory); session lists leave the view (Choose folder → OS dialog per D19) |
| D19 | Dogfood r2 batch: border-lit focus, dead-center modals, vendor app tiles + Codex scan-only row, OS folder picker, inbox inline markdown, commit-open resolution, btn icon alignment |
| D20 | Dogfood r3 batch: content-aware live status (lag P0), progress on the task's own day, scrim returns, Dispatch to header + Session field + files/PR-only artifacts, objective modal on the task anatomy, select-all checkboxes + Clear filters *(filter half amended by D29)* |
| D21 | Deployed seed is authored fiction mirroring the demo story; no substrate export ships publicly |
| D22 | Icons move to Material Symbols Outlined (wght 500, inlined paths; selection fills via FILL-1); wordmark takes Roboto Serif at 24px above a 20px page title |
| D23 | Dogfood r4 batch: calm empty-state voice, full-tile Codex mark, color-muted disabled rows + state chips, breathing modal text boxes, dispatch glyph, two-line session links, status joins the modal Save gate, objective-modal scroll grammar, friendly-name imports off sessions-index.json |
| D24 | Dogfood r5 batch: the two waits split by content (claim + no question = Ready at once), bulk task delete with menu-confirm, Inbox project filter with honest counts, board fills the view height, Progress loads on the r4.1 skeleton grammar *(delete + filter amended by D29)* |
| D25 | Artifact-less sign-off cards fall back to the agent's last message (waiting-card excerpt treatment); artifact-carrying cards stay artifact-first |
| D26 | The Inbox's clear queue is the one celebratory moment: full-height hero, celebration glyph, "You are all caught up!", a ruled exception to D23's calm empty-state voice |
| D27 | A dir-bearing project is never excluded: pointing a project at a directory adopts its Claude Code store dir and lifts the connect-time exclusion (save-time + boot reconcile) |
| D28 | Projects can be deleted (card overflow menu; confirm on the mini-dialog chrome naming the consequence): tasks unassign rather than die; a connected project's store dir returns to the exclusion list |
| D29 | UI r3 batch: column heads reserve the action slot (board alignment), the filter undo rehomes inside each menu as a scoped Clear and select-all retires from filters, objectives can be deleted via bulk delete (children promote, tasks unassign) |
| D30 | Imports are content-aware and skip stillborn sessions: the connect import runs the D24 content pass (claim + no question lands Ready at birth), and zero-assistant-turn transcripts never reach the picker or the import |
| D31 | Full design review + shadcn/ui migration: the primitive layer moves to shadcn (agency-setup's vetted default), sheet stays sovereign; focus trap ships, entrances join the motion set, z-scale closes on portal order; review-fix batch (voice, truncation, dates home, sidecar gate) |

## Entries

### D1: PRD spine (2026-07-14)

*Amended by D5 (v0 evidence source narrowed to sessions only), D6 (compounding demoted to post-MVP), and D7 (conversational capture, the F1 fix, demoted to P1).*

The thesis stands, recentered: closure (Break 2) and compounding are the load-bearing claims; the attention break stays as context, not foundation (red-team F3: the attention evidence carries a supervision product, not a tracker). One PRD covers the full product vision with an explicit v0 cut. The MVP is the **closed day-loop**: all five grammar elements (Intent, Evidence, Reconciliation, Compounding, Handoff) present at demo depth; the cut falls on sources and polish, not on grammar: sessions + git live, calendar if cheap, email out of v0. The six findings of a red-team pass over the thesis (F1–F6) fold into the PRD as requirements. Maintainer ratified 2026-07-14 during PRD intake.

### D2: Prototype data modes (2026-07-14)

*Amended by D21 (2026-07-15): the deployed seed is authored fiction mirroring the demo story, never a sanitized export of real substrate.*

Two modes through one adapter interface. **Live-local:** the maintainer's dev instance reads the real substrate (Claude Code session store, watched git repos) read-only, so iteration happens against real data. **Demo-seeded:** the deployed prototype ships a sanitized seeded snapshot shaped exactly like the real sources, declared as demo data in the UI, never faked as live. Maintainer ruled 2026-07-14 (intake Q2); the honest-instrument rationale is red-team F6.

### D3: Working name: Trail (2026-07-14)

The product's working name is **Trail**. Explicitly provisional ("for now"); a naming pass may still happen in the design session, and a rename would supersede this entry. Maintainer ruled 2026-07-14.

### D4: v0 build focus (2026-07-14)

Calendar is cut from v0 entirely (stays P1; no build-time discretion). v0 focus: the local session end-to-end (Claude Code session store + git ingest, matcher, reconciliation, recap) running live on the maintainer's real substrate. The stack ⚖ ruling is deferred until the design proposal is complete (design does not depend on it); it still gates build. Maintainer ruled 2026-07-14.

### D5: Session-only evidence and the harvester (2026-07-14)

v0's sole evidence source is the Claude Code session store: for an agent-native operator, transcripts subsume the rest (what was asked, what was done, files touched, commits made, where friction hit). Git demotes to P1 as a cross-check of transcript claims; email stays P2. Linking is dispatch-first: a task dispatched from Trail carries its id into the session, so the evidence chain is deterministic, no matching. Non-dispatched and imported sessions get one **harvester** pass per session (task-link suggestions with confidence, outcome evidence with source pointers, friction notes, candidate lessons); below-threshold links are operator-confirmed, never silently promoted. The harvester replaces the general matcher and the separate friction-extraction component, and resolves the matcher ⚖. Cold start: Trail offers to import existing local sessions at setup (backfill). Amends D1's source cut. Maintainer ruled 2026-07-14.

### D6: Compounding on the operator's clock (2026-07-14)

Lesson accumulation is never gated on a hard-coded trigger (the drafted "same friction ≥2 times" rule is rejected). Instead: on demand, or on a schedule the operator sets, Trail audits past sessions as a process-improvement check (where context is drifting, what recurring manual prompting can be context-engineered into the workspace) and drafts propose-only patches. This is post-MVP: not P0, and out of scope for the v0 design lane. Mechanics need more thinking; parked as an open question. v0 keeps the substrate: the harvester stores friction and candidate lessons per session so the auditor has material when it exists. Amends D1 ("all five grammar elements at demo depth": compounding is present in v0 as stored substrate only). Maintainer ruled 2026-07-14.

### D7: Intake cut: conversational capture demoted to P1 (2026-07-14)

MVP intake is manual task creation (then in-Trail dispatch) or an external Claude Code session detected/imported by Trail. R2 (conversational capture, braindump into structured tasks) moves P0 → P1, and the intake/chat surface is out of v0 design scope: the product is about task tracking, not capture. Goal 3's ≤2-minute plan acceptance stands via list interaction (accept/trim the draft plan on the board). Amends D1 (the F1 fix is no longer a v0 requirement). Maintainer ruled 2026-07-14 during the design session.

### D8: Task status model: six states, human-ratified Done (2026-07-14)

*Amended by D11 (the dedicated sign-off action is removed; the human-only-Done invariant stands), D12 (recap groupings deferred from the v0 surface), and D17 (artifact thumbnails render on the Inbox; detail-only stands everywhere else).*

One status field, six values: **Planned, Running, Waiting, Ready, Done, Shelved**. Status is decoupled from date; Shelved is the undated backlog. **Ready → Done is always a human move** (sign-off in the task detail); no automation ever sets Done. **Artifacts** (the term replacing "evidence": outputs with source pointers, commits, PRs, session segments, documents) are task-detail properties only, never shown in list or board views. This reframes zero-maintenance: the machine moves tasks to Ready on evidence with zero manual edits below Ready (≥70% of completed tasks reach Ready by evidence alone), and Done is always a deliberate ratification, Done is never a claim. Amends PRD Goal 1 and R10; supersedes the session's earlier three-verdict per-task taxonomy (confirmed / claimed-unverified / open render as recap groupings derived from status + artifacts, not as statuses). Maintainer ruled 2026-07-14.

### D9: MVP view set (2026-07-14)

*Amended by D12 (Recap → Progress, condensed to the completed-only day list; view names renamed Dashboard / Backlog / Progress / Projects) and D14 (Workspace's import home moves to the settings connect flow).*

Five surfaces, each serving one lens: **Backlog** (objective → task tree; objective rows are interactive rows, not group headers), **Board** (kanban with status lanes minus Shelved; Today default with a This-week toggle; the morning draft plan pre-seeds the Planned lane under an accept bar: R7 lives here), **Task/objective detail** (GitHub-issue-style modal: activity + artifacts), **Recap** (what moved today), **Workspace** (working directories, their sessions, and the import/backfill flow, R4 lives here). The task IA gains a **working directory** attribute (the Claude Cowork "project" analog). The intake chat surface is out per D7. Maintainer proposed the set and ruled it 2026-07-14.

### D10: Visual identity (2026-07-14)

*Amended by D22 (icon grammar moves from the custom stroke set to Material Symbols Outlined; Roboto Serif joins the ruled faces for the wordmark alone).*

*Amended by D31 (overlay and reveal entrances join the ruled motion set on the duration tokens; motion-as-liveness otherwise stands).*

*Extended at the 2026-07-15 mock rounds: heat-ramp tokens `--heat-1..4` authorized (D12's grid; five shades with the empty gray); new library icons (nav set, calendar, chevrons, plus, check, close, pencil, open-link, arrow); type/state item icons parked.*

*Amended by D19 (vendor brand-mark tile colors are identity, exempt from meaning-hue rationing; the focus treatment becomes the border-lit rule).*

*Extended 2026-07-15 at convergence (build night): `--radius-xs: 2px` ruled for the heat-grid cells, the proposal's open micro-decision, taken as a token over a spec'd metric.*

Palette: charcoal `#252525` ink, electric blue `#1E52F3` brand, cool sparse neutrals; light-first, with the dark theme grounded on the same charcoal. Type: Roboto + Roboto Mono; headings keep weight 400: hierarchy by size and color, 500 for labels only. Meaning-hues rationed to three: blue = the product's hand and the Ready decision point; green = Done and nothing else; amber = Waiting (ball in your court) and nothing else; liveness is motion, not a hue: the Running badge's breathing dot is the product's only continuous animation. On the board, the column carries state and cards stay clean. The sheet (`design/design-system.html`) was rebuilt to this law directly on the design branch: an establishment-phase exception to proposal-first staging, per maintainer instruction. Maintainer ruled 2026-07-14 across the session's redline rounds.

### D11: Manual status moves unrestricted; sign-off action removed (2026-07-15)

*Amended by D17 ("Sign off" returns as the Inbox's verb for the manual Ready→Done move; both invariants stand).*

Manual status changes are never blocked: the operator may move any task to any state (Done included) by board drag or the task detail's status field. The dedicated "Sign off" action is removed; the status control is the one state-move path, and Save (disabled until dirty) owns the modal footer's primary slot. D8's invariant narrows to its true core: **no automation ever sets Done**, agents are the default way work moves, never the only way; plenty of tasks get finished by hand. Amends D8 (its "sign-off action in the task detail" rendering; the human-only-Done invariant stands). Maintainer ruled 2026-07-15, mock redline round 5.

### D12: Progress condensed to the completed-list; verdict surfacing deferred (2026-07-15)

*Amended by D15 (heat depth and the day list count Ready alongside Done) and D17 (the view set gains Inbox).*

The Progress view (Recap's ruled name; the full nav set renamed Dashboard / Backlog / Progress / Projects at round 2) leads with a GitHub-style activity grid, twenty-six weeks, five shades (the empty gray plus authorized brand-hued tokens `--heat-1..4`), cell depth = completions that day, every day selectable, and the selected day's detail is one list: tasks completed that day, project pill first, then title, nothing else. Verdict groupings (confirmed / claimed-unverified / open), the drift section, and the objective rollup are **deferred from the v0 surface** pending post-prototype evaluation; the reconciliation engine still computes and stores all of them (instrument honesty is recorded, not yet rendered). Amends D9 (Recap description) and D8's recap-groupings note; PRD Goal 2, R6, R10, and §10 wording swept to match (v1.2). Maintainer ruled 2026-07-15, mock redline rounds 2–6.

### D13: Prototype stack and gates (2026-07-15)

*Amended by D14 (the operator-picked import call is superseded by the settings connect flow).*

*Amended by D31 (the stack gains Tailwind and the shadcn/ui primitive layer; the gates stand).*

Vite + React + TypeScript SPA; Node (Fastify) sidecar owning the local adapters, harvester, dispatch, and live updates (SSE); JSON file store under `app/data/` (tasks/objectives/sessions/recon/settings documents plus append-only `evidence.jsonl` and `activity.jsonl`; gitignored). Gates ruled with the stack: `tsc --noEmit` + `npm test` (Vitest), applied per commit, never crossed red. Demo mode (D2) ships as a static Vite build with the seeded adapter compiled in: the sidecar never deploys, so the live substrate never leaves the machine (F5); Vercel deploy is maintainer-run. Resolves the stack ⚖ deferred by D4. Maintainer ruled 2026-07-15 at build kickoff, alongside three implementation calls within D5's frame: harvester language pass via headless `claude -p` (degrades to heuristic-only), dispatch via a Windows Terminal-spawned interactive session carrying the task-id marker, and import as operator-picked directories (no auto-import).

### D14: Agent-app connect flow (2026-07-15)

*Amended by D18 (the Projects view's substrate lists retire; projects gain an editable name and an optional directory).*

*Amended by D27 (dogfood r5.1): connect-time exclusions no longer outrank the operator's own projects, pointing a project at a directory adopts its store dir and lifts the exclusion.*

*Amended by D19 (the scan may list detection-only apps, Codex first, disabled rows, never importable; ingest stays Claude Code only).*

Dogfood ruling batch (maintainer, first MVP dogfood). Import leaves the Projects page and lives in a **settings flow**: a Settings item at the nav footer opens a modal holding the light/dark theme switch and an agent-apps section. Importing history and watching future sessions consolidate into **one connect action per app**: connecting Claude Code (a two-step picker, app, then what to bring; projects and sessions both default-selected) imports its project directories, turns past sessions into tasks, and leaves the watcher tracking every new session thereafter. Projects persist in the store with a display name (the directory path's leaf segment) plus the path. Session→task mapping: title from the session name (first prompt as fallback), no objective link, date = last activity, Waiting when action is pending from the operator, otherwise Ready (automation's ceiling, D8/D11 unchanged). **Claude Cowork is out of MVP scope**: Claude Code sessions and directories only. Build judgment calls riding this ruling, open to veto: 30-day backfill window (watcher unwindowed; `TRAIL_IMPORT_WINDOW_MS`), no language pass on backfill (close-time pass per R5 unchanged), Trail's own headless harvest sessions excluded from import/watch by prompt prefix. Amends D9 (Workspace as import home) and D13 (operator-picked import). Maintainer ruled 2026-07-15; numbered D14 at the r1B wave assembly. Progressive disclosure revision (dogfood r1B, same day): the settings modal became a settings **menu** (theme switch + "Connect agent apps…"), and the connect modal became a two-step stepper, pick the agent app, then pick projects and the sessions within them; **only sessions belonging to selected projects import**, and unselected projects persist as exclusions the watcher honors.

### D15: Progress counts Ready alongside Done (2026-07-15)

*Amended by D20 (bucketing moves off transition days: each ready/done task counts once, on its own `task.date`, statusAt-day fallback).*

*Extended at r1B.2 (build): tasks born Ready or Done with no status transitions (imported sessions) count on their own day, `task.date`, else the createdAt day; any later transition hands them to the transition rules and the born signal withdraws.*

Dogfood r1B ruling (maintainer item 7): the Progress view considers both Done and Ready progress in the heat grid and the day list. Heat cell depth = the day's ready + done on the one brand-hued intensity ramp (no second hue; distinguishing is the list's job). The day list renders both groups, Done first, a status badge per row. Projection semantics as built: Done counts on the day of the latest move into Done while the task stands Done; Ready counts on the day of the latest move into Ready while the task stands Ready-or-Done, withdrawn if it leaves Ready anywhere but Done; a same-day ready→done counts once, as Done. Ready remains a display signal only: the automation-never-Done invariant (D8/D11) is untouched. Amends D12's completed-only day list; the rest of D12 (verdict/drift/rollup deferral, view names) stands. Maintainer ruled 2026-07-15, dogfood round 1B.

### D16: Task-modal editing: inline interaction, Save-gated commit (2026-07-15)

*Amended by D23 (dogfood r4): status joins the Save gate inside the modal, it stages like any other field and persists through moveStatus on Save; board drags stay immediate.*

Dogfood r1B.3 ruling (maintainer item 4), revising the r1B.2 built behavior: text and field edits in the task modal (title, description, project, date, objective) stage locally and persist only on **Save** (footer, rightmost, primary, disabled unless dirty; one `updateTask` carries every dirty field). The inline interaction stands (click the text to edit in place, no pencil affordance, no modal-wide edit mode: the r1B cut's interaction survives; its commit-on-blur does not). **Status stays immediate** and outside the gate: it is the one state-move path (D11), applied like a board drag. A dirty close (footer, X, outside click, Escape) discards silently. Creation keeps Cancel + Create. Maintainer ruled 2026-07-15, dogfood round 1B.3.

### D17: Inbox: the attention-queue view (2026-07-15)

*Extended at redline round 1 (2026-07-15): the sidebar count chip becomes a 6px static presence dot, no number, provisional ("for now").*

*Extended at redline round 2 (2026-07-15): sign-off goes batch, selection checkbox per card, one section-head Sign off acting on the selection (disabled at zero; still the manual Ready→Done move, D11 intact); cards collapse to header rows, first expanded; Open session becomes a link-style control; the per-artifact reviewed-checkbox is dropped; section heads carry status dots (board col-dot grammar); artifact opens follow a per-type destination map, destination named on tile hover.*

*Extended at redline round 3 (2026-07-15): the primary reads "Sign off all selected", disabled until a selection exists; since-stamps dropped (age lives in the ordering); the collapse caret adopts the tree-row recipe (plain 10px, no button chrome); destination map ruled simpler and documented as its own sheet-bound section: sessions → terminal resume (r1B.2), links (PRs/commits) and html → browser, everything else → editor (VS Code v0); one source module, per-type overrides post-v0.*

*Extended at redline round 4 (2026-07-15): images leave the editor bucket, png/jpg/svg open directly in the OS viewer (new `i-image` library icon). Header interaction still ⚖ in the proposal handoff: variant B (whole-header disclosure, leading caret) mocked as main, variant A (trailing caret) parked; the maintainer's pick completes this stamp.*

*Extended at redline round 5 (2026-07-15): the r4 ⚖ ruled, variant B stands (whole-header disclosure, leading 12px caret); Open session returns to the right cluster with the artifact count. The on-tile destination overlay is dropped: the kind→destination map remains a build rule (every surface consults the one module), and tile hover is a brand-border highlight, a link affordance, not a state hue.*

*Extended at redline round 6 (2026-07-15): the artifact count sits beside the project chip, Open session alone on the right; tile hover also reveals the open-link glyph in `brand-text` before the artifact name (space reserved, no reflow).*

*Amended by D19 (the destination map's commit rule: resolve the project remote to a commit URL, else `git show` in a terminal; the waiting excerpt renders inline markdown).*

*Amended by D20 (the artifact projection narrows to files + PR links, deduped; sessions become the task modal's own field; commits stay evidence: timeline and recon proof, no tile; "Sign off selected").*

Design session ruling batch (maintainer, inbox/projects session). A fifth nav destination, **Inbox**: noun register matching the ruled view names; "Review" rejected as a verb among nouns, "Workspace" as saying nothing. It sits under Dashboard and holds everything awaiting the operator's judgment, in two sections. **Needs sign-off:** Ready tasks, oldest-Ready first; each card carries the task title (opens the task modal), project pill, a ready-since stamp from activity events, an artifact strip, and the actions **Sign off** (primary) + **Open session** (secondary, the feedback path). **Waiting on you:** Waiting tasks, oldest first; each card shows the agent's last message clamped to ~3 lines, with **Open session** primary: answering is the verb there. Artifact strip: thumbnail tiles, real previews for previewable files (html/md/images), icon tiles for commits/PRs/sessions, never fake previews, each carrying a soft checkbox: a persisted personal reviewed-tally that never gates anything. "Sign off" returns as this surface's verb for the manual Ready→Done move: shorthand, not a new mechanism; D11's invariants (moves unrestricted, automation never sets Done) stand untouched. The sidebar item carries a quiet count chip (ready + waiting). Pending link suggestions stay out of the Inbox (task modal only, per D18). Empty states per section; both empty renders one calm line. Amends D8 (artifacts detail-only: thumbnails now render on the Inbox), D11 (the sign-off verb returns), and D12 (the view set gains Inbox). Trade-offs accepted on record: thumbnail preview infrastructure is a real build cost inside the prototype window, chosen over plain artifact rows; the last-agent-message excerpt needs an adapter extension. Maintainer ruled 2026-07-15.

### D18: Projects becomes a management surface; projects are first-class (2026-07-15)

*Amended by D19 (Choose folder opens the OS folder dialog via the sidecar; the r1 in-app directory browser and `/api/fs/dirs` retire).*

Same session. The Projects view drops its session lists and becomes project management: a card grid, name, folder chip (Local folder / No folder), middle-truncated mono path, task count, with a **New project** action in the view head. Clicking a card opens the project modal (the established modal grammar): editable name, optional directory with a folder picker (live-local: sidecar-backed directory browser; demo: text input, browsers cannot expose real paths); the same modal empty is the create flow. The project becomes a first-class entity: `id`, editable `name`, optional `dir`, no source field (maintainer: noise). The connect flow (D14) keeps auto-creating projects for imported directories; tasks re-key `projectDir` → `projectId`. Pending link suggestions surface in the task modal only: ruled against an Inbox section for them. Accepted cut: sessions with no confirmed task and no pending suggestion have no browsable home in v0; suggestion rot is accepted (nothing prompts a visit). Amends D14 (its Projects-view description and leaf-name-only naming; the connect flow itself is unchanged) and D9's Workspace lineage. Maintainer ruled 2026-07-15.

### D19: Dogfood round 2: maintainer UI ruling batch (2026-07-15)

*Amended by D22 (the Codex placeholder hexagon is replaced by the official Codex mark, LobeHub colored variant, on a white app tile).*

*Amended by D31 (item 2's focus-trap deferral retires: the Radix dialog ships the trap and restore; the 1px border-lit focus rule of item 1 was revisited and reaffirmed).*

Maintainer feedback from testing `feat/inbox-projects`, ratified as one batch. Amends D10, D14, D17, D18 (stamped above).

1. **Focus lights the border.** One global rule, a 1px brand outline hugging the component's own edge (`outline-offset: -1px`) on `:focus-visible`, replaces the two-layer ring everywhere; the `--focus-ring` tokens retire and no component writes its own focus rule. Brand-filled carriers (primary buttons) light in `--brand-ink`. Trade-off on record: a 1px edge is subtler than the two-tone ring accessibility guides prefer; accepted for a personal tool, revisit if keyboard-first use grows.
2. **Modals sit dead center, both axes.** The wrapper centers on flex; the panel caps at the padded viewport and floats on `--shadow-float`; no scrim stands (2026-07-15 ruling untouched). The wrapper carries `role="dialog" aria-modal="true"`. Focus trap / focus restore deliberately out of v0.
3. **Agent-app rows show the vendor's shipped mark**: the Claude spark in white on its orange app-icon tile (`--brand-claude` #d97757, both themes). The r1B.1 mono rule narrows to inline uses rather than retiring. Vendor tile colors are identity, not meaning-hues: rationing is untouched.
4. **Codex rides the scan, honestly**: detected from `~/.codex/sessions` (recursive jsonl count), rendered as a disabled row with an "Import not supported" caption; placeholder hexagon mark until a licensed glyph lands. Ingest stays Claude Code only.
5. **Choose folder opens the OS folder dialog** via the sidecar (`POST /api/fs/pick`, PowerShell FolderBrowserDialog behind a TopMost owner; pwsh first for the modern dialog, Windows PowerShell fallback). The D18 r1 in-app directory browser and `GET /api/fs/dirs` retire. Live-local only; the demo keeps the plain text input.
6. **The waiting excerpt renders inline markdown** (`src/lib/md.tsx`): bold at label weight 500, italics, inline code on the data face over a `gray-100` chip; links and images collapse to their text; heading/list/quote markers strip: block structure has no home in a three-line clamp.
7. **Commits open somewhere real**: `/api/open` resolves the session project's `remote.origin.url` to `<remote>/commit/<sha>` (ssh→https normalized) in the browser; a project with no URL remote falls back to `git show <sha>` in a terminal at the project directory. Best effort, honestly: an unpushed sha may 404.
8. **Buttons align icon and label on one centerline** (`.btn` becomes inline-flex, space-2 gap): fixes the New project glyph misalignment.

Not ruled here: kind-glyph color coding for artifact tiles (maintainer floated blue terminal / green PR), parked as an open ⚖ question with a recommendation against; the mono glyphs stand meanwhile. Maintainer feedback 2026-07-15, ratified as dogfood round 2.

### D20: Dogfood round 3: maintainer batch, live-status P0 first (2026-07-15)

*Amended by D29 (2026-07-16): item 6's filter half retires, select-all leaves the filter menus and "Clear filters" rehomes inside each menu as a scoped "Clear" row. The bulk-header select-all checkbox and the connect modal's stand.*

Maintainer feedback while dogfooding the r2 build live, ratified as one batch. Amends D15, D17 (stamped above); supersedes the mock-round no-scrim ruling.

*Amended by D24 (dogfood r5): item 1's waiting split by content, a completed turn that claims an outcome and asks nothing goes Ready at once, not after the 30-minute close.*

1. **Live status is content, not clock (the P0).** A transcript ending on a completed assistant turn (text, no pending tool call) is *waiting the moment Trail sees it*; the old mtime heuristic held tasks at Running for up to two minutes (90s idle grace + 30s sweep) after the agent had already asked its question. The parser tracks turn state (`awaitingInput`), the watcher's fast path applies it at harvest, and the idle sweep tail-reads only changed files (300 sessions stay cheap). The clock keeps its two jobs: fresh-write = running while the agent is mid-tool, long-idle = closed.
2. **Progress counts on the task's own day.** Each ready/done task counts once, under its current status, on `task.date` (undated: the day the status landed). The transition-day replay died with the batch sign-off that teleported two weeks of imported work onto today. Known edge on record: a task done ahead of a future date counts on that future day.
3. **The scrim returns** (`--scrim`: 45% ink light / 55% black dark): the undimmed modal blended into the page. Supersedes the mock-round "no scrim, ever"; outside-click close unchanged.
4. **Task modal regrammar:** Dispatch rides the title row (the header grammar's main-action slot; Planned only); **Session is the task's own side-rail field** (link rows resuming in a terminal); **artifacts are files + PR links only, deduped**, commits stay evidence (timeline rows, recon proof, recon now checks evidence kinds, not the display strip; D19's commit-open plumbing stays for the API, tiles gone); the crumb slot never collapses ("No objective linked").
5. **Objective modal adopts the task anatomy:** editable title, description + task rows in the main column, parent/child objective *links* in the side rail (tree restructuring is not a modal edit in v0); creation is the same modal blank, replacing the 42rem form.
6. **Every select/deselect-all carries its own checkbox** (checked / mixed dash / empty), the bulk-header grammar generalized; **an active filter earns its undo**: "Clear filters" leads the Backlog cluster only while filtered; **"Sign off selected"** (label trimmed).

Answered, not built: Codex ingest ("why is codex not supported?"), no adapter for the Codex transcript format exists in v0; the scan row is honest detection (D14/D19). Building one is parked as a post-v0 candidate. Maintainer feedback 2026-07-15, ratified as dogfood round 3.

### D21: Deployed seed is authored fiction, never substrate export (2026-07-15)

*(Filed as D19 on a parallel branch, 2026-07-15; renumbered at merge: main's dogfood rounds had taken D19/D20.)*

The public deployed build never contains real substrate, however sanitized: its seed is authored fiction, shaped like live-adapter output (D2's parity contract stands) and curated to mirror the demo day's story, analogous objectives, projects, and task shapes; invented history. Rationale: sanitizing exported personal data is a long-tail review burden with a leak-shaped failure mode, and the boundary itself becomes a demo line, the real substrate never leaves the machine (F5's posture). Consequences: the substrate export/sanitizer pipeline dies unbuilt; the demo work rescopes to reshaping the existing authored seed (`app/src/lib/demo/seed.ts`) plus inlined previews and a demo reset. Demo-mode connect stays a simulation over the seed (ships pre-connected; a static page can read no local store: verified, `DemoClient.connectApp` is a no-op); dispatch stays the context-pack + replayed-stream shape. Amends D2's letter ("sanitized seeded snapshot"). Maintainer ruled 2026-07-15.

### D22: Icons to Material Symbols; the wordmark takes the serif (2026-07-15)

*(Filed on the polish branch; numbered D22 at the 2026-07-16 merge: main had taken D19–D21.)*

*Amended by D23 (dogfood r4): the Codex tile loses its border and fill, the official mark renders full-tile, corners clipped to the shared tile radius.*

*Extended at redline (2026-07-15): selection rides the fill axis, glyphs whose Material FILL-1 form differs carry both paths in one symbol, toggled by the `--icon-o`/`--icon-f` custom props (they pierce the `<use>` shadow boundary); the active nav destination renders filled in `brand-text`. Hover and focus keep the outline form: the maintainer reversed the first-cut hover fill live. Hue never changes with the swap.*

*Extended at the merge with main (2026-07-16): main's three new glyphs joined the law, inbox → Material `inbox`, image → Material `image` (both dual-path); the Codex placeholder hexagon is replaced by the official Codex mark (LobeHub icon set, colored variant, own baked gradient: maintainer's pick over Material `hexagon`), joining the Claude spark as a third-party mark with its own path; its app tile goes white so the mark reads as shipped. Supersedes D19's "placeholder hexagon until a licensed glyph lands."*

UI polish session, two rulings taken together. **Iconography:** every product icon now comes from **Material Symbols Outlined** (wght 500: the closest optical match at 12px to the retired 1.4 stroke), official path data inlined into the existing symbol library; the delivery law is unchanged (inline SVG symbols by `<use>`, no icon font, no external sprite) and ids stay semantic. Maintainer chose the contested glyphs from presented options: pr → `merge` (Material has no pull-request glyph; the custom GitHub-grammar glyph was offered and declined), settings → the `settings` gear (over `tune`, which matched the old sliders shape), dashboard → `grid_view`. The Claude spark stays as drawn: the exception narrows from "filled vs stroked" to "third-party marks keep their own path." **Type:** Roboto Serif joins the ruled faces for the wordmark alone (`--font-serif`, `--type-brand` 400 24px), the brand name is the largest type on screen; `--type-title` steps down 24px → 20px so page titles sit under it. Self-hosted via fontsource like the other faces. Amends D10 (its icon library and two-family type law). Maintainer ruled 2026-07-15.

### D23: Dogfood round 4: polish-lane maintainer batch (2026-07-16)

*Amended by D26 (dogfood r5.1): item 1's calm empty-state voice gains its one ruled exception, the Inbox's both-sections-empty state becomes the celebratory clear-queue hero.*

*Extended at r4.1 (2026-07-16, pre-merge batch): async content loads behind shape-matched skeleton placeholders, a new `.skel` grammar breathing on `--duration-live` (loading is genuinely live, the motion law's liveness clause; settled content never pulses): and panels keep their settled size while loading: the task modal opens as a skeleton shell, both connect steps show skeleton rows, step 2 takes a fixed `min(34rem, 100%)` height. The connect modal renamed to the settings menu item's name verbatim ("Connect to agents") with both step captions rewritten in the calm register ("Agent apps found on this machine. Trail reads their sessions and writes nothing." / "Trail watches included projects and imports their new sessions."); the Projects empty-state line and "Not found" casing swept in the same round. The objective modal carries one 26rem min-height either mode. The Inbox's double gap died (`:first-of-type` counted divs and never fired; the adjacent-sibling selector carries the rule). Command-wrapper chrome (`<local-command-caveat>` and kin) never becomes a first prompt or a task title.*

*Extended same day (the maintainer pushed on item 10's coverage gap): the desktop app's own session store found, `%APPDATA%/Claude/claude-code-sessions/**/local_*.json`, one record per session with `title` (auto or user-renamed) and `cliSessionId` mapping to the CLI store's transcript. The adapter reads it read-only (cached, 60s TTL; macOS path + env override covered), slotting between the custom-title record and the CLI index: customTitle → desktop title → index summary → first prompt. 102 of 103 desktop records titled on the dev machine: friendly names now cover all desktop-launched sessions; the LLM-title ⚖ narrows to pure-CLI and headless sessions and stays parked.*

Ten-item maintainer batch on the polish lane, ratified together. (1) **Voice: empty states carry good news calmly**, "All caught up" (Inbox), "Nothing to sign off" / "Nothing waiting" (sections), "Nothing yet" (Progress day); "Nothing needs you" and "No progress" died; the rule joins the sheet Voice list. (2) **The Codex tile is the mark itself**: no added border or fill, the official mark (white plate + gradient glyph) renders full-tile, corners clipped to the shared tile radius; amends the D22 white-tile treatment. (3) **Disabled rows mute by color, not opacity**: text to gray-700 and legible, vendor marks keep identity colors, and the state rides a chip beside the name ("Connected", "Not supported") so agent-app rows stay one line tall. (4) **Modal text boxes breathe**: the title button/input share one full-width flex box with vertical padding (selection never presses the edge, the whole row is the edit target, task and objective modals alike); the description edit is a real multi-line field, min-height 6rem with a native vertical resize handle (the auto-grow textarea retired). (5) **Dispatch carries the send glyph** (new library icon, Material `send`, dual-path). (6) **Session links reflow**: break-anywhere, two-line clamp inside the fixed 15rem rail; the rail never scrolls horizontally. (7) **Status joins the Save gate in the modal**: a status pick stages like any other field and persists through moveStatus on Save (still logging as a move); board drags stay immediate; amends D16/D20.4's "status alone stays immediate", D11's unrestricted-moves invariant untouched. (8) **The objective modal takes the task modal's scroll grammar**: body fixed, the Tasks list alone scrolls. (9) *(with 4)* full-width title selection in both modals. (10) **Imported tasks title from the session's friendly name**: the adapter reads Claude Code's per-project `sessions-index.json` (customTitle → index summary → first prompt); coverage is honest: the index exists only where Claude Code's own picker has built it, and the LLM-title follow-up is parked as an open ⚖ question. Maintainer ruled 2026-07-16.

### D24: Dogfood round 5: e2e bug batch on the dispatch lane (2026-07-16)

*Amended by D28 (item 2's "no-delete for projects" note retires: projects gain delete with unassign semantics).*
*Amended by D29 (2026-07-16): item 2's bulk delete reaches objectives, and its menu-confirm holds for tasks alone, an objective in the selection escalates the confirm to the mini-dialog chrome. Item 3's "Clear filters" follows D20.6's rehoming.*

Maintainer feedback from end-to-end testing of the merged polish + dispatch-fix build, ratified as one batch. Amends D20 item 1 (stamped above).

1. **The two waits split by content.** A completed assistant turn that *claims an outcome and asks nothing* is a finished lap: the linked task goes **Ready** the moment Trail sees it, not after the 30-minute close ("no open PRs, all clean" had sat in Waiting on you). A turn ending on a question (trailing markdown chrome stripped before the "?" test) or claiming nothing genuinely waits on the operator and stays Waiting. The claim must ride the session's latest activity; a stale claim from an earlier turn proves nothing about this one. The Ready ceiling (D8/D11) and closed-without-claim → recon both stand.
2. **Tasks can be deleted (bulk, Backlog).** "Delete" (trash glyph, Material `delete`) joins the bulk cluster rightmost after Set objective; the confirmation is the button's own one-item menu naming the count ("Delete 3 tasks"): a deliberate second click, never a dialog. The store drops the task and unlinks its sessions; the append-only activity/evidence logs keep their rows: history stays evidence. D18's no-delete rule for projects is untouched.
3. **The Inbox takes the Backlog's project filter.** Left of "Sign off selected", filtering both sections; each section count turns honest while rows hide ("3 of 56", bare otherwise); an active filter earns Clear filters (D20.6's law); the selection is only ever cards the filter shows, so batch sign-off never touches a hidden row.
4. **The board fills the view.** Dashboard columns run to the view's bottom edge (`content-fill`): the whole column below the header is the drop target in fact, not just to the cards' extent.
5. **Progress loads on the r4.1 grammar.** Shape-matched breathing heat cells and a skeleton day-count line until the day counts land; nothing jumps.

Parked, not built: surfacing the session's last message on artifact-less sign-off cards (many imported Ready tasks carry no artifacts), an open question pending the maintainer's call. Maintainer feedback 2026-07-16, ratified as dogfood round 5.

### D25: Artifact-less sign-off cards fall back to the agent's claim (2026-07-16)

Resolves the ⚖ parked at D24: many imported Ready tasks carry zero artifacts, leaving the expanded card's strip empty, nothing to judge the sign-off on. Ruling: when an expanded sign-off card's artifact strip is empty, the session's last message renders in the waiting-card excerpt treatment (three-line clamp, inline markdown), the agent's own claim is the only evidence there is, and the sign-off ratifies exactly that claim. Fallback, not default: cards with artifacts stay artifact-first; a card never shows both (the message would duplicate what the tiles already prove). `composeInbox` carries `lastMessage` on sign-off cards for both clients. Maintainer ratified the filed recommendation 2026-07-16 (dogfood r5, item 7).

### D26: The clear queue is the one celebratory moment (2026-07-16)

The Inbox's both-sections-empty state upgrades from a calm caption card to a full-height hero: the view fills (`content-fill`), the Material `celebration` glyph (48px, `gray-600`) centers over "You are all caught up!" in title type. Rationale: an empty attention queue is the product's win condition (the operator cleared everything the agents brought) and it deserves the one moment of joy in an otherwise calm register. Scope is exactly this surface: a ruled exception to D23 item 1 (stamped), and nothing else in the product exclaims; section-level emptiness ("Nothing to sign off", "Nothing waiting") and other views' empty states stay calm captions. No new hue: the glyph rides the muted icon gray; rationing untouched. Maintainer ruled 2026-07-16 (dogfood r5.1).

### D27: A dir-bearing project is never excluded (2026-07-16)

Resolves the maintainer's r5.1 confusion ("my project has the exact same directory: how is that excluded?"): connect-time exclusions were keyed on store-dir slugs and never consulted the projects table, so a manually created project pointing at an excluded directory left the watcher blind to it, the operator had declared interest twice (a project, plus dispatches from it) and the old connect decision still won. Ruling: pointing a project at a directory is a declaration of interest that outranks a connect-time exclusion. Saving a project with a directory adopts the matching Claude Code store dir onto the project (`ensureConnectedProject`, so watcher-born sessions land on the operator's project instead of a duplicate) and removes that store dir from `excludedStoreDirs`; a boot reconcile applies the same rule to stores written before it. Directories with no Claude Code store are a no-op. Exclusions still persist for directories no project points at (D14's letter, stamped). Maintainer surfaced 2026-07-16 (dogfood r5.1).

### D28: Projects can be deleted; their tasks unassign (2026-07-16)

Maintainer asked for project deletion directly (morning request on the ui lane), reopening the D24-era "no-delete for projects" note (stamped above). The Projects card gains an overflow menu (`more_horiz` kebab, top-right, its own target inside the card button): **Edit project** opens the same modal the card click does; **Delete project** opens a confirmation on the mini-dialog chrome (`.menu.note`: the demo banner's note generalized into a shared grammar): title "Delete {name}?", one paragraph naming the consequence (the project alone is deleted; its tasks are not deleted: they stay in the backlog, unassigned), footer Cancel · Delete. Maintainer ruled the dialog over the first-cut r5-style menu-confirm: deleting a whole organizational bucket earns a real dialog where retiring selected tasks did not. No destructive hue (rationing holds). Semantics: the project's tasks unassign (`projectId` clears) rather than die, deleting an organizational bucket must not destroy work records; a connected project's `storeDir` returns to `excludedStoreDirs` so the watcher does not resurrect the project from new sessions (D14's letter: exclusions persist where no project points), and recreating a project on that directory lifts the exclusion again (D27, unchanged). Both clients carry `deleteProject`; `DELETE /api/projects/:id` is the one route. Maintainer requested and refined 2026-07-16 (ui r2).

### D29: UI round 3: board alignment, the filter undo comes home, objectives can be deleted (2026-07-16)

Maintainer brought three UI nits on the ui lane; two reopened standing rulings (stamped above). Ratified as one batch.

1. **Column heads reserve the action slot.** Maintainer: "why are tasks under Planned not on the same vertical level as other columns?" Cause: `.col-head` sized itself to its content, and only Planned carries the add button, a 24px control in an 18px label box, so that one head grew, centered its label 3px low, and started its cards 6px below every other column. Ruling: every head declares `height: calc(1.5rem + var(--space-1))` whether or not it holds an action. The head is one baseline across the board, and a future column action costs no realignment. Verified computed: five heads at 28px, five labels at y=81.7, five card tops at y=114.

2. **The filter undo lives inside the menu it undoes; select-all retires from filters.** Maintainer asked to drop select-all from the status and project filters and move "Clear filters" into the menu rather than stand it beside them. This amends D20.6, and the amendment was already earned: once ui r1 ruled *empty means unfiltered*, checking every box showed the same list as checking none, so select-all only ever paid for itself as check-all-then-prune, and Clear is the control the operator was actually reaching for. Ruling: each filter menu carries its own **Clear** row last, on the `sep-above` rule, rendered only while that filter is applied and resetting **only that filter**, the control that set a filter is the control that lifts it, and the Status menu never silently wipes a project filter. Nothing stands beside the cluster, so the filter row keeps its width filtered or not. Scope: Backlog (Status, Project) and Inbox (Project). The bulk header's select-all checkbox is untouched (it drives a real selection, not a filter), as is the connect modal's `.sel-all`: D20.6's checkbox grammar stands everywhere it still has a consumer. Cost accepted: clearing both Backlog filters now takes two menus; the maintainer chose scoped honesty over the one-click reset.

3. **Objectives can be deleted, through the bulk control.** Maintainer asked for objective deletion; the surface chosen over a modal-footer delete was the Backlog's existing bulk Delete, which also closes a standing wart: objective rows rode the select-all and the "x of y selected" counter while every bulk write ignored them, so "3 of 5 selected" could answer "Delete 2 tasks". Ruling: **Delete is the one bulk write that reaches objectives**; Mark as / Move to / Set objective still touch tasks alone, since an objective carries no status or project. Semantics generalize D28's law: nothing under an objective dies with it: its tasks unassign (`objectiveId` clears) and its child objectives **promote to level 1** rather than orphan, because the tree only roots from level 1 and a child left pointing at a gone parent would render nowhere. The confirm scales to the damage rather than picking one chrome for both cases: tasks take nothing down with them, so they keep D24.2's menu-confirm naming the count ("Delete 3 tasks"), a deliberate second click, no dialog; the moment an objective joins the selection the confirm escalates to the mini-dialog chrome (D28's `.menu.note`) and names the survivors ("2 tasks will stay in the backlog, unassigned. 1 child objective will move to the top level.", or "Nothing else will change."). Rows already in the selection never count as survivors: they die on their own account, and double-counting them would misreport the damage. Both clients carry `deleteObjective`; `DELETE /api/objectives/:id` is the one route. `deletePlan` owns the confirm's two strings and is unit-tested.

Maintainer requested 2026-07-16 (ui r3); the three forks (clear scope, delete surface, cascade rule) were put to the maintainer before build.

### D30: Imports are content-aware; stillborn sessions never import (2026-07-16)

The maintainer's live import of real session history surfaced two gaps, fixed on the import-status-dedup lane. (1) The connect import birthed task status from the clock-only statusForSession and never ran applyLiveStatus, so a session whose closing turn claims an outcome and asks nothing landed Waiting: its artifact invisible to the Inbox sign-off queue until the 30-minute close swept it. Ruling: the import loop runs the content pass after ensureTaskForSession; D24's "content decides between the two waits" applies at birth, not only on the watch path. (2) A queued prompt re-dispatched into a fresh session file leaves a stillborn transcript (the prompt, zero assistant turns) and importing it minted a phantom duplicate task. Ruling: SessionSummary carries hasAssistantTurns; the connect picker and the import skip sessions without one. Title/prompt dedup was considered and rejected: intentional reruns share prompts (the demo seeding does exactly this). The live watch path is deliberately untouched: a just-started session appearing Running before its first reply is the product working. Maintainer requested the fix 2026-07-16, same session the bugs were diagnosed.

### D31: Full design review; the primitive layer moves to shadcn/ui (2026-07-20)

The maintainer asked for a full design review of Trail against agency-setup's standards and ruled the stack question it surfaced: Trail hand-rolled every UI primitive while the agency library's sources registry names shadcn/ui the recommended base ("components-by-default is the standing posture"). Ruling: **full shadcn migration**, the primitive layer is shadcn/ui components (Radix underneath), the sheet stays sovereign, and where a library default disagrees with a ruled law the component is restyled, never the law relaxed. Amends D13 (stack: Tailwind + shadcn join; the tsc + vitest gates stand, applied per phase).

Sub-rulings taken with it, each put to the maintainer:

1. **beUI skipped.** The vetted motion layer stays out while the Motion law rations motion to liveness (sources.md's own "only when the project rules motion in").
2. **lucide rejected.** shadcn components ship lucide glyphs; every one is replaced by the Material Symbols library (D22 stands). Vendor marks unaffected.
3. **Entrances admitted** (maintainer pick over the strip-entrances recommendation): menus and popovers reveal on `--duration-reveal`, modals enter on `--duration-overlay`, both on the one easing; the demo toast still appears plainly (its law outranks this). Amends D10's letter.
4. **Focus trap ships.** The Radix dialog carries the trap and restore D19.2 deferred; the 1px border-lit focus rule was revisited and **reaffirmed** over shadcn's ring (D19.1 stands). Amends D19.
5. **Z-scale closed.** Radix portal order replaces the 40/50 literals; no z-index literal ships in app code. The standing open question retires.
6. **One-primitive law kept over shadcn's menu taxonomy**: every float panel rides the one popover component; DropdownMenu never ships. Outside click keeps leaving focus where the user clicked (reaffirmed); Radix collision logic replaces the letter of the flip rule.
7. **Checkbox forms follow HTML**: the Radix control where the box is its own element, a span form inside row buttons (nested buttons are invalid), a display-only mark where the row carries the action, one home, three renderings (the review's three hand-rolled variants collapse).

The review's fix batch rode the same lane: the heat-cell tooltip's em dash died (voice law), the task-modal objective menu gained the 28ch cap + hover title, the task card lost its un-ruled 17rem base width, the html-preview canvas's white was ruled deliberate (a document render reads as paper, both themes), local-date formatting single-homed into `src/lib/dates`, and the sidecar pinned CORS to local origins and gated `POST /api/open` on the evidence log before any spawn (route-tested). Findings the review cleared without change are on record in the session log. Maintainer approved the plan and the contested picks 2026-07-20.
