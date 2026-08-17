# ARC — Technical Architecture & UX Flows v1.0

*Follows PRD v1.0. Covers stack, data model, invariants, and screen flows. No visual design.*

---

## 1. Stack

**Next.js (App Router) + TypeScript + Tailwind, deployed to Vercel. Postgres (Neon or Supabase). Installable PWA.**

Rationale, in order of weight:

1. **Durability is the top constraint.** "History is permanent" is Law 1 — losing the database destroys the entire value of the product, and the value compounds, so a loss in month 14 is catastrophic in a way it isn't for most apps. Managed Postgres with automated backups is non-negotiable. Local-only storage (IndexedDB, local SQLite) is rejected for exactly this reason.
2. **Agent-buildable.** Next.js + TypeScript + Postgres has the densest training representation of any stack, which matters because you're building with agents rather than by hand.
3. **PWA satisfies the mobile constraint** without native build surface, app store, or a second codebase — appropriate for a product whose mechanics are still calibrating.

Auth: single user, single credential. Whatever the chosen host offers with the least ceremony. Do not build user management.

## 2. Data architecture

Event-sourced for conduct, mutable for direction. This is the direct implementation of Law 1.

### 2.1 The event log

One append-only table, the source of truth for everything that happened.

```
events
  id            uuid pk
  type          text            -- see §2.2
  occurred_at   timestamptz     -- when it happened in the world
  recorded_at   timestamptz     -- when it was written (never equal by assumption)
  logical_day   date            -- see §2.5
  domain        text nullable
  subject_id    uuid nullable   -- quest, stance, season, mark
  payload       jsonb
  idempotency_key text unique nullable
```

**Invariants — these are enforced, not conventions:**

- No UPDATE. No DELETE. Ever. No exceptions for corrections.
- A correction is a new event of type `*.corrected` referencing the original.
- Every user action that represents conduct writes an event **before** any projection is updated, in the same transaction.
- `payload` is additive-only; fields may be added, never repurposed.

### 2.2 Event types (v1)

```
commitment.completed        quest.created
commitment.missed           quest.step_completed
condition.logged            quest.abandoned
mark.recorded               probe.resolved       { double_down | fold | extend }
stance.changed              outcome.achieved
attention.event_logged      season.opened
life.entry_logged           season.closed
day.reported                recovery.started
app.opened                  return.detected
```

`commitment.missed` is written by a nightly job at the logical day boundary, not by the user. Absence must be recorded explicitly — a gap in the log is ambiguous, and momentum depends on the difference.

### 2.3 Direction tables (mutable)

`quests`, `commitments`, `stances`, `seasons`, `references`, `people`.

These hold current state and are freely editable, subject to one rule: **editing direction never touches history.** Abandoning a quest appends `quest.abandoned` and sets `status`; it never deletes the row and never removes its completions from the log.

Weekly commitment immutability is enforced at the data layer: a commitment whose `week_start` is the current week rejects writes to its definition fields. Not a UI guard.

### 2.4 Derived values

XP totals, domain levels, momentum state, dormancy, and rank eligibility are **computed from the event log**, never stored as authoritative counters. Cache them in a `daily_rollup` table keyed by logical day for read performance, but the rollup must be reconstructible from events alone.

Test for this: a `rebuild` command that drops all rollups and recomputes from the log must produce identical state. If it can't, the model has drifted and the retrospective layer is already broken.

### 2.5 Time

Single timezone, stored in config. A **logical day boundary at 04:00 local** — a session logged at 1am belongs to the previous day, which is how people actually experience nights. Every event carries `logical_day` computed at write time.

### 2.6 Idempotency

Completion writes carry an idempotency key of `{commitment_id}:{logical_day}:{seq}`. Double taps on a phone are the normal case, not an edge case.

### 2.7 The Attention layer

Sensitive by nature. Requirements:

- Separate table (`attention_events`), never joined into general activity views
- Excluded from every aggregate that feeds the Loop, the nightly report, or XP
- Excluded by default from any future export
- Stances with status `not_now` are filtered at the query layer, so the behaviour cannot appear in any surface even by accident

### 2.8 Calibration constants

One module: `lib/calibration.ts`. XP tier values, level cost curve, momentum thresholds, dormancy days, rank tenure, season prompt weeks, return threshold days, recovery phase length.

No numeric literal governing progression may appear anywhere else in the codebase. These change after four weeks of use; they must change in one place.

## 3. Structural requirements

**XP must be removable.** PRD §24.7. Concretely: nothing in momentum, rank, Marks, history, or the report may read from XP or level values. XP is computed at the display layer from the event log. Deleting the XP module should break only the XP display.

**No AI dependency.** No model SDK in v1's dependency tree. The rule-based skeleton must stand alone.

**No notification infrastructure.** No push service, no scheduled sends. The only background job is the nightly rollup and `commitment.missed` writer.

## 4. UX flows

Screen states and transitions only.

### 4.1 Baseline audit — first run

Linear wizard, resumable, ~20–30 min. Steps: domains (free text) → retroactive Marks (min 3, note required each) → body baseline metrics → stances (including *Not now*) → the three 2027 statements → Season 01 opening declaration.

Terminates on the character sheet, fully populated, with derived starting rank and a one-line explanation of it. **No screen in the app may be empty after this completes.**

### 4.2 Today — the Loop

One route, three states selected by time relative to the logical day boundary and report hour.

**Morning** — read-only. Rank · momentum · season/day · main quest · today's commitments. Full visual investment; this is the emotional surface. No-commitment days render the calm variant from PRD §12.1.

**Day** — commitment rows. Tap completes and immediately presents the three resistance options inline; the completion is already written, resistance patches it. Optional one-line note behind a secondary tap. No other affordance may be added to this screen.

**Night** — the report (PRD §12.3). Generated deterministically by the rollup job; the screen only renders it. Report length follows activity.

### 4.3 Character sheet

Identity: rank, four domains with levels, tenure. Momentum state. Condition. Outcomes list (the 2027 statements). Marks, most recent first. Entry point to history.

### 4.4 Quests

Four sections. Creation forms per type. Probe creation requires decision date and declared signal — both blocking. When a probe's decision date passes, its card enters a resolution state on the morning screen and stays there until resolved; resolution requires a note. Folding is presented with identical visual weight to doubling down.

### 4.5 The Ritual — weekly

Wizard, 20–30 min: review the week from the log → write the week's narrative (free text, required to advance) → relationship absences → probe decisions if due → declare next week's commitments. Commitments lock on submission.

### 4.6 Attention layer

Own entrance from the character sheet, never linked from Today. Stance list. Logging is two taps: state + preceding condition, both from short fixed lists, free text optional. Display: rolling 28-day density and trend only. **No day counter may be rendered anywhere in this surface.**

### 4.7 Life layer

Log of experiences and people. Absence timers surfaced only in the Ritual. The unscored status is stated in the interface copy.

### 4.8 Seasons

Open wizard (including the required *deliberately ignoring* field) and close wizard (five prompts → rank evaluation → Chapter written). Chapters are read-only forever.

### 4.9 Return

Interstitial, shown once on first open after ≥14 days. Auto-closes the open season into a Chapter, shows the PRD §19 panel, offers Recovery Phase, then releases to a re-openable direction state. Never shown twice for the same gap.

## 5. Build milestones

| # | Milestone | Done when |
|---|---|---|
| 1 | Event log + calibration module + rebuild command | Rebuild produces identical state from events alone |
| 2 | Character model: domains, XP, levels, momentum, condition | Values computed from log, not stored |
| 3 | Baseline audit | Produces a fully populated character sheet |
| 4 | The Loop: morning, logging, nightly rollup + report | Full day usable end to end under 3 minutes |
| 5 | Quests: commitments → undertakings → probes → outcomes | Weekly lock enforced at the data layer |
| 6 | Marks and evidence | Note required, artifact optional, Reference type working |
| 7 | The Ritual + Seasons (open, close, Chapter) | A season can be opened and closed |
| 8 | Attention layer + Life layer | No day counters exist anywhere |
| 9 | Return protocol | Simulated 67-day gap produces the correct interstitial |
| 10 | Two hidden quest rules + self-instrumentation | Day-60 usage report generatable |

**Milestones 1–4 are the smallest livable product.** Start using it for real at the end of 4 and continue building underneath yourself — the calibration numbers you need for §26 of the PRD only exist once you're logging real days.

## 6. Deliberately excluded from v1

Offline write queue (add at 1.1 if mid-day logging actually fails), export, theming, any model SDK, push infrastructure, multi-device sync beyond what the database gives for free, tests beyond the rebuild-equivalence check and the weekly-lock enforcement.
