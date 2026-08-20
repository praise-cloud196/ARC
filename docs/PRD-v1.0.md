# ARC — Product Requirements Document v1.0

*Codename ARC. Single-user v1. Companion documents: Philosophy & Mechanics v0.2, MVP Scope v0.1 — this PRD supersedes both where they conflict.*

*Scope note: this is a product document. Technical architecture, schema, stack and project structure are deliberately excluded and follow separately.*

---

## 1. Summary

ARC is a personal progression system that measures the developing capacity to deliberately choose what you do — agency — across four domains of life, and produces a permanent, believable record of who you are becoming.

It is not a habit tracker with RPG graphics. The game layer exists to make the record worth keeping; the record is the product.

## 2. Premise

The system cannot gate real capability, withhold anything, or issue a reward that means anything on its own. Its only real powers are **memory**, **recognition**, and **framing**. Every requirement in this document draws on one of those three.

The corresponding failure mode — self-issued currency in a self-refereed game — is addressed by three structural choices: XP is derived from a fixed tier schema rather than priced by the user, weekly commitments are set in advance and immutable during the week, and the scoring formula is frozen for the duration of a season.

## 3. Goals

- Produce a truthful, permanent record of conduct across four domains
- Make progress visible at three separate timescales without collapsing them into one number
- Survive interruption — including multi-month absence — without loss, shame, or reset
- Fit a three-minute daily budget
- Point the user outward, toward life, rather than inward toward the app

## 4. Non-goals

- Retention for its own sake
- Completeness of life coverage
- Multi-user, social, or shareable anything
- Clinical, therapeutic, or addiction-treatment functionality
- Replacing existing tools for writing, notes, calendars, or health data

## 5. Success criteria (evaluated at day 60)

1. Used on ≥40 of 60 days without deliberate effort to protect the number
2. Measured daily loop time stays under three minutes
3. At least one instance where the record surfaced something true that the user had misremembered or forgotten
4. A bad week was logged honestly rather than avoided
5. The first season chapter reads as a record of a person, not a spreadsheet

Criterion 4 is the most important. If the user disappears *because* things went badly, the product has failed at its central promise regardless of other results.

## 6. User

Single user, personal-first. Assumptions v1 is permitted to make: one person, one timezone, one language, one device class primarily (mobile) with desktop access, no onboarding funnel, no account recovery flows, no empty-state education beyond what one person needs once.

## 7. Vocabulary

Canonical terms. Implementation must use these names.

| Term | Meaning |
|---|---|
| **Domain** | One of four areas of life. Schema name; display name may differ. |
| **Identity** | Slow layer — domain levels, Marks, tenure. Never decreases. |
| **Momentum** | Medium layer — rolling 14-day commitment completion, expressed as a state. |
| **Condition** | Fast layer — today's sleep/energy. Never scored. |
| **XP** | Activity-ledger unit. Derived from quest tier. |
| **Mark** | Achievement-ledger unit. Permanent, note-required, evidence-optional. |
| **Rank** | Global identity letter, E→S. Moves only at season close. |
| **Season** | A 6–12 week chapter of focus. |
| **Commitment** | A recurring input declared weekly. Scored. |
| **Undertaking** | A multi-week project the user controls. Scored by step. |
| **Probe** | A time-boxed bet with a decision date and declared signal. |
| **Outcome** | A desired result the user does not control. Never scored, never failed. |
| **Stance** | The user's declared relationship to a behaviour they want to reduce. |
| **Reference** | A labelled external link standing in for content the app does not store. |
| **Chapter** | The written record of a closed season. |

## 8. Domains

Four, fixed in v1.

| Domain | Scored | Primary objects | Notes |
|---|---|---|---|
| Career / Capability | Yes | Probes, Undertakings | Positioning treated as an open question resolved by evidence |
| Body | Yes | Commitments, metrics | Manual entry only. Carries the first six weeks. |
| Attention / Inner life | Yes | Commitments, Stances | Contains the private layer (§16) |
| Life / Relationships | **No** | Log, absence timer | Unscored by design and visibly so |

## 9. Entities

Conceptual, not schema.

- **Event** — the atomic unit. Every completion, log, Mark, stance change, quest state change, season boundary, and app open is an event. Append-only. Never edited, never deleted.
- **Projection** — current state (active quests, commitments, stances, levels, momentum) derived from the event log and freely mutable.
- **Quest** — Commitment | Undertaking | Probe | Outcome
- **Mark** — note (required), artifact (optional), domain, date, source quest (optional)
- **Season** — open declaration, dates, chapter, rank evaluation
- **Stance** — behaviour, current stance, history of stance changes
- **Reference** — label, URL, attached entity

**Requirement:** history is permanent, direction is flexible. Abandoning a quest appends an abandonment event; it never removes the quest or its completions from the record.

## 10. Progression rules

All numeric values below are **calibration constants**, provisional until four weeks of real data exist. They must be defined in one place and changeable without touching logic.

**XP.** Assigned by quest tier, never entered by the user.

| Tier | Definition | XP |
|---|---|---|
| 1 | Routine, ≤30 min | 10 |
| 2 | Substantial, 30–90 min | 25 |
| 3 | Demanding, 90+ min or genuinely hard | 50 |

**Resistance tag.** One tap on completion: *easy / normal / against resistance*. Recorded; does not modify XP.

**Domain levels.** Per-domain, no global level. Levels never decrease. Cost *of* level *n* = 100 + 50(n−1) — the marginal cost of that one level, not cumulative. Cumulative XP to *reach* level *n* is the running sum of that: `xpToReachLevel(n) = Σ levelCost(k)` for k = 1..n−1 (level 2 at 100, level 5 at 700, level 10 at 2,700). This table originally documented the marginal figure as if it were cumulative, which would have put level 10 at 550 XP — reachable in about a week; `docs/milestone-2-spec.md` §2 corrects it. Where this section and that document differ, the spec document wins.

**Dormancy.** A domain with no conduct for 21 days enters a dormant display state. No penalty, no loss. Distinct from momentum's Dormant state below (7 days, whole-character) — the two windows are not the same thing (`docs/milestone-2-spec.md` §5).

**Momentum.** Completion rate of declared commitments over trailing 14 days, compared to the prior 14. Displayed as a state, never a percentage. The table below is under-determined as written — "Building" and "Strong" overlap, and it doesn't say what happens with no prior period or no commitments at all. `docs/milestone-2-spec.md` §3 resolves it into an exact, ordered state machine; that document is authoritative and this table is kept here only as the informal summary:

| Order | State | Condition |
|---|---|---|
| 1 | Dormant | No conduct for 7+ days (never Attention-layer activity, never `app.opened`) |
| 2 | Strong | Current rate ≥80% — checked *before* Slipping, so a small dip off a strong period still reads as Strong |
| 3 | Building | Rate improving beyond a small stable band vs. the prior period |
| 4 | Slipping | Rate declining beyond that band vs. the prior period |
| 5 | Holding | Everything else, including "no commitments exist" (never Slipping) and "no prior period yet" |

**Condition.** One tap for sleep and energy. Feeds the nightly report and future pattern detection. Never scored, never labelled good or bad.

**Rank.** E → D → C → B → A → S. Evaluated **only at season close**. Promotion requires: new Marks in ≥2 domains during the season, minimum tenure at current rank (provisional: 1 season), and no more than one dormant domain at close. Rank never decreases.

## 11. Surface: Baseline audit (onboarding)

Run once. Target 20–30 minutes. Produces a complete character sheet — **no state in the product may be empty at the end of onboarding.**

Captures:

1. Current state in each domain, free text
2. **Retroactive Marks** — past achievements, entered with notes. Minimum 3 prompted, no maximum.
3. Body baseline: user-defined metrics with current values
4. Stances for each behaviour the user chooses to name (including *Not now*)
5. The three 2027 statements, recorded verbatim as top-level Outcomes
6. Season 01 opening declaration (§15)

Starting rank is derived from the audit and displayed with a one-line explanation of why. Expected range D–C.

## 12. Surface: Today (the Loop)

One surface, three states. Total daily budget: three minutes.

### 12.1 Morning (30–60s, read-only)

Displays: rank · momentum state · season and day number · active main quest · today's commitments. Nothing else. This screen receives full visual investment; it is the emotional surface of the product.

**No-commitment day.** Days with no scheduled commitments are legitimate and must not appear broken or accusatory:

```
DAY 37 · SEASON 01
No commitments today.
MAIN QUEST — Build a stable, independent future
Momentum: Strong

Nothing is required of you today.
```

### 12.2 During the day

One-tap completion. One-tap resistance. Optional one-line note. Nothing else may be added to this interaction.

### 12.3 Night: the System Report

Rule-based, deterministic, **maximum five lines**. No AI. Computed on demand from the log for the current logical day whenever the app is opened, not generated by a scheduled job at a fixed hour — a fixed hour either fires while work is still in progress or fires after the boundary has already closed the day, and for a schedule that regularly runs past midnight, no single hour is right. The report is final once the logical day boundary passes. The screen switches to its night state at a user-set **display hour**; that hour is a presentation choice only, never a data cutoff. (Amended by `docs/milestone-1.1-fixes.md` item 4b.)

**Governing rule: the report never grows in response to failure.** Report length follows activity. A day with nothing logged produces a *shorter* report, not a longer one. This is what prevents it from becoming a lecture.

Additional rules:

- Never mentions the Attention layer (§16)
- Never uses exclamation marks, praise inflation, or second-person encouragement
- Never states or infers how the user feels
- The closing framing line is drawn from a fixed set, selected deterministically by condition, may not repeat within 7 days, and **is omitted when nothing true can be said**

**Variants:**

*Complete day*
```
DAY 34 · SEASON 01
Complete. 4 of 4.
Body +50 · Career +25
Momentum: Strong
Three of the last five days ran clean.
```

*Partial day*
```
DAY 35 · SEASON 01
3 of 5.
Career +50 · Attention +10
Not logged: Train, Reflect
Momentum: Strong — unchanged
```

*Empty day*
```
DAY 36 · SEASON 01
Nothing logged.
Momentum: Strong — holding

Day incomplete. Progress continues.
```

*Day containing a Mark* — the Mark is the last line, so it is what the user finishes on
```
DAY 41 · SEASON 01
4 of 4.
Body +50 · Career +25
Momentum: Strong
MARK — 10 pull-ups, clean. Recorded.
```

*First day after a return*
```
DAY 1 · SEASON 04
First entry in 67 days.
Train · logged

The record resumes.
```

## 13. Surface: Quests

**Commitment.** Declared for the coming week during the Ritual. Immutable Monday–Saturday: completable, failable, not editable. Carries a domain, a tier, and a weekly target count.

**Undertaking.** Max 3 active. Ordered steps; XP on step completion. Completion may generate a Mark.

**Probe.** Max 2 active. Requires a declared decision date and a declared signal at creation — neither is optional. At the decision date the user must resolve: *double down / fold / extend once*. **Folding is recorded as a successful close**, with a required note on what was learned. Extension is permitted once only.

**Outcome.** No schedule, no score, no failure state. Displayed on the character sheet as what the user is pointed at. On achievement, converts to a Mark and a major history event.

## 14. Surface: Marks and evidence

Two evidence standards:

- **Routine actions** — self-attestation only. No proof, ever. The three-minute budget depends on this.
- **Marks** — a note is **required**; an artifact (URL, image, document, Reference) is optional.

The note prompt is fixed and is not "describe what you did":

> **What changed because of this?**

Mark states: **Completed** (note only) · **Documented** (note + artifact). A third state, *Verified*, is reserved in the model and not implemented in v1.

Marks are permanent. They award no XP.

## 15. Surface: Seasons

**Open.** Declares: what matters most this season, which domains receive attention, the season's main quests, the behaviours being developed, and — as a required field — **what is being deliberately ignored for now**.

**Duration.** 6–12 weeks. The season ends when the user ends it. The system prompts for close at week 8 and again at week 12; it never force-closes.

**Frozen during a season:** the XP tier values, level costs, and domain structure.

**Close.** Prompts: what changed, what was learned, what continues, what is abandoned, what the next season is. Rank is evaluated here. The result is written to a permanent **Chapter**.

A season cannot be failed. Its only output is a chapter and a set of conclusions.

## 16. Surface: Attention layer (private)

Behind its own entrance. Never appears on the morning screen. Never affects XP. Never appears in the nightly report unless the user navigates to it.

**Stances**, per behaviour: *Observing · Reducing · Abstaining · Not now*. Stances may only be changed at season boundaries. **Not now** means the behaviour is not tracked, not counted, and never referenced by the system in any surface.

**Event logging.** Two taps: time is implicit; the user selects a state and a preceding condition from short fixed lists. Free text optional. No reflection prompt at the moment of logging.

**Display: rolling 28-day density and its trend.** *"9 in the last 28 days, down from 15."* **No day counters, no streaks, no clean-since dates.** This is a hard requirement, not a copy preference.

**Pattern reporting** (correlations with sleep, condition, day of week) requires ≥8 weeks of data and ships when the data exists, not before.

**Boundary.** If frequency or distress trends upward consistently over a long window, the system states once, plainly, that this looks like something worth getting real help with — then does not raise it again. No diagnosis, no repetition, no suggestion that XP or discipline is a treatment.

## 17. Surface: Life layer

Unscored, permanently. No XP, no level, no completion, no target.

Two behaviours only:

1. **Remembers** — a log of experiences, people, and things done that weren't productive
2. **Notices absence** — time since last contact with named people, surfaced in the weekly Ritual only

The interface states explicitly that this domain is not scored. That statement is a feature.

## 18. Surface: The Ritual (weekly)

20–30 minutes, deliberately slow. Everything that doesn't fit the Loop lives here.

Sequence:

1. Review the week from the log — completions, misses, resistance distribution
2. **The user writes the week's narrative** in a short structured prompt. Not generated in v1.
3. Relationship absences surfaced
4. Probe decisions, if a decision date has landed
5. Declare next week's commitments — which then lock

## 19. Surface: Return protocol

Triggered on first open after a gap of ≥14 days.

Requirements:

- Character intact. Nothing expired, no counter reset, no loss displayed anywhere.
- The open season **auto-closes into a Chapter**. A season cannot be failed by absence.
- Display: what the user had been working toward, what they accomplished before the gap, elapsed days, which commitments may no longer be relevant.
- Direction is fully re-openable. Quests may be abandoned without penalty; abandonment is recorded as a decision.
- **Recovery Phase** offered, never mandatory: a reduced set of 1–2 commitments. Bounded at two weeks, available only following a genuine gap, not user-selectable at will.

Register:

```
The System has been waiting.
Your previous progress remains.
You left during Season 03 with 3 active Main Quests.
67 days have passed.
Some things may have changed.
```

## 20. Hidden quests

Rule-based only. Nothing generated. A hallucinated pattern would permanently destroy the effect.

v1 implements two rules; maximum one surfaced per week:

1. **Return** — activity following 7+ days dormant. Recognized, never scolded.
2. **Undeclared consistency** — 12+ occurrences in 28 days of an action never declared as a goal

Deferred until data allows: resistance pattern, convergence, mirror.

## 21. History

**Write path complete, read path minimal.** Every event the future retrospective layer will need must be captured from day one; almost none of it is displayed in v1.

v1 displays: the activity log, Marks, domain levels over time, and Chapters.

Deferred by physics: the mirror (*one year ago / today*), the annual retrospective, multi-season comparison.

## 22. Self-instrumentation

The app records its own use: every open, session duration, and days with zero activity. At day 60 it produces an honest usage report against the criteria in §5. This data is for evaluating the product, is never displayed as a score, and never appears in the Loop.

## 23. Voice

Flat, terse, factual. States what happened. Does not console, exhort, over-congratulate, or interpret feelings. No exclamation marks. No "you've got this."

Reference register:

> **Day incomplete. Progress continues.**

**Message budget:** the nightly report, plus at most one other system message per day, plus the Ritual. A recognition that fires daily is wallpaper within a fortnight.

## 24. Constraints

1. Daily loop under three minutes — measured, not assumed
2. Mobile-accessible; the Loop happens on waking, mid-day, and at night
3. **Zero notifications.** No exceptions in v1.
4. **Zero AI.** No model calls anywhere in v1.
5. Single user; no auth complexity, no sharing
6. Manual data entry only; no health integrations
7. XP and levels must be removable without touching momentum, rank, Marks, or history

## 25. Out of scope

**Deferred, will ship later:** AI weekly and seasonal narrative, probe decomposition, setback interview, the mirror and annual retrospective, Attention pattern reporting, three hidden quest rules, health integrations, export.

**Permanently out:** classes, skill trees and unlocks, boss battles as a distinct object, guild terminology, streaks, a global level, inventory, currency, leaderboards, social features, sharing, AI coaching chat, any clinical or treatment framing.

## 26. Open — calibration

To be fixed after four weeks of real use, not before:

1. XP tier values and level cost curve
2. Momentum thresholds
3. Rank tenure minimums
4. Season length within the 6–12 week band
5. Product name and in-world display vocabulary
