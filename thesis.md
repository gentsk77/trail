# Thesis — An Agent-Native Personal Task Tracking System

Status: v1 draft, 2026-07-14. This document is the product bet; requirements and build scope derive from it. Research citations trace to a prior personal research program on agent supervision UX (four streams: neuroscience/psychology, practitioner sentiment, market landscape, feasibility); sources linked inline.

## 1. Who this is for

This system is built by and for a fully agent-native knowledge worker: someone whose execution is largely delegated to AI agents (multiple Claude Code sessions running across repos on any given day), and whose work and life are already recorded across a personal substrate — agent session transcripts, git history, calendar, and email. The system is designed to plug into that substrate directly.

The scoping is deliberate and honest: a task tracker for a less AI-native user would take a different shape, because their ground truth lives in their head and their hands, not in their tooling. This product makes no attempt to serve them. Designing for the agent-native case first is a bet that this is where knowledge work is heading, and that the person best positioned to specify the product is someone already living there.

## 2. The problem: two breaks, one root

**The root cause: execution has moved into agent sessions, so the human no longer experiences doing the work.** When agents write the code, draft the documents, and run the migrations, the human's day becomes planning, steering, and reviewing — and the felt experience of "I did this" disappears. Practitioner sentiment converged on this inversion through 2025–26; as Nolan Lawson put it, "instead of *writing code*, I'm being asked to constantly *read code*" ([AI ambivalence](https://nolanlawson.com/2025/04/02/ai-ambivalence/)). Two specific breaks follow, and I feel both personally.

**Break 1 — attention.** Because agents are capable but slow, the natural response is to parallelize: several sessions at once, switching whenever one blocks. This runs directly against hardware limits. Working memory holds roughly four chunks (Cowan, 4±1); every unfinished task leaves attention residue on the next (Leroy 2009); heavy switching can consume up to ~40% of productive time (Meyer, APA aggregate). The developer of Super Productivity reports that even three parallel agent sessions "cognitively doesn't scale" — you lose track of which terminal is on which branch ([DEV Community](https://dev.to/johannesjo/why-multitasking-with-ai-coding-agents-breaks-down-and-how-i-fixed-it-2lm0)). The felt symptom is multi-task fatigue: drained by lunchtime without a single stretch of flow.

**Break 2 — closure.** At the end of a heavy day the honest answer to "what did I actually get done?" is often "a lot, I think?" The evidence of the work is real, but it is scattered across session transcripts, commits, and PR threads the human never typed. This is not poor memory; it is the predictable result of not having performed the work with your own hands. The wider evidence says self-assessment under delegation is systematically unreliable: in METR's 2025 RCT, experienced developers were 19% slower with AI while believing they were 20% faster; in Upwork's 2025 survey, 77% of workers said AI tooling had increased their workload. One essay describes the end state as standing still for ten seconds "trying to remember what I was going to do next" ([The Human Cost of 10x](https://news.ycombinator.com/item?id=47758863)).

**And the classic tracker failure compounds both.** Every mainstream task tool — Todoist, Things, Linear-for-one — assumes the human is the write path: you enter the task, you update the status, you mark it done. That is double-entry bookkeeping against work that is already fully recorded elsewhere, and it is why personal trackers rot within days of adoption. For an agent-native user the truth already exists in the substrate; existing trackers simply refuse to read it.

## 3. The claim

**For an agent-native worker, a task tracker's job is no longer to capture tasks — it is to continuously reconcile stated intent with the substrate evidence of what actually happened, and to compound each gap into better procedure for the next task.**

Three consequences fall out of this claim:

1. Planning becomes cheap and honest, because the system already knows what happened yesterday.
2. Closure becomes automatic, because "done" is harvested from evidence rather than self-reported.
3. The system improves the *work itself* over time, because reconciliation deltas — the places where the plan and the reality diverged, where friction burned an hour — are exactly the raw material for procedure improvements. For an agent-native user, procedure is executable: a CLAUDE.md line, a skill, a memory entry. Lessons do not just inform the human; they compile into the agents' operating instructions. The tracker becomes a flywheel, not a ledger.

## 4. Product grammar

**Intent — nested objectives and linked tasks.** Standing objectives form a small tree: L1 objectives are life-level ("start my own company", "live a healthier lifestyle"); L2 objectives are strategies under them ("join a startup where I learn frontline GTM skills", "box twice a week"). Tasks are concrete and dated ("prepare for interview", "boxing class @ 7pm") and link to the objectives they serve. "Today" and "this week" are views and reconciliation cadences over this structure, not separate data levels. Because every task traces to a why, a recap can answer not just "what did I do" but "what did it move."

**Evidence — read-only substrate ingest.** The system reads the Claude Code session store (what was asked, what shipped, where friction hit), git across watched repos (commits, PRs, issues — ground truth of shipped work), and calendar + email (commitments and time evidence for the non-coding half of life). Ingest is strictly read-only: the system observes the substrate; it never mutates it.

**Reconciliation — the daily and weekly heartbeat.** At day and week boundaries the system diffs the plan against the evidence. The recap is honest closure: tasks confirmed done by evidence, tasks claimed but unverified, effort spent that moved no objective (drift is surfaced, never hidden). The morning plan starts from last night's reconciliation, bounding today's working set to what attention research says a human can actually hold.

**Compounding — friction into procedure.** When the same friction recurs across similar tasks (similarity defined by shared objective family), the system drafts a procedure patch: an edit to CLAUDE.md, a skill, a checklist, a memory entry. The write path is propose-only — the human reviews and applies. This keeps trust clean while still closing the loop from "this hurt twice" to "this is now handled."

**Handoff — from task to agent, context included.** Any task can be handed to an agent as a pre-contexted session: the task, its objective chain (the why), and the accumulated lessons from its family travel with it. The tracker is the natural dispatcher precisely because it is the one system holding both intent and evidence. In the proof-of-concept this is one deliberate bridge — launch a Claude Code session pre-loaded with task context — not an orchestration layer.

## 5. Anti-goals

- **No team features.** Personal use, one operator. No sharing, assignment, or permissions.
- **No manual-first data entry.** Manual entry is allowed but never required; the system must stay truthful even if the human never updates a status by hand. A tracker that rots when neglected has failed its core claim.
- **No points, streaks, or badges.** Gamification's base rate is failure (Gartner ~80%); what transfers from games is structure, agency, and closure — not reward schedules. The celebration is an honest recap, not XP.
