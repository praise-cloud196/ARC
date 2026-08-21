# Milestone 4.1 — four corrections

*Review of milestone 4. Item 1 is time-critical: it must be resolved before the real baseline audit is run.*

Milestone 4 is strong. The single-query proof, the weekly-lock trigger, and catching the double-submission are all right. Two of the four items below are corrections to my specs rather than to the implementation.

---

## 1. Separate the development database from the real one

**Severity: critical. Blocks the real audit.**

Testing through the UI wrote permanent placeholder data into the database, and `audit.completed` can only be written once, so the only remedy was dropping the schema. That is going to happen again — and the next time it happens after the real audit has run, there is no remedy at all.

The append-only design means development and real use cannot share a database. This was implicit in the architecture and should have been explicit.

Required:

- **Two Neon branches.** `main` holds real data and is never written to by a test, a script, or an agent. A `dev` branch is disposable and may be reset freely.
- `.env.local` points at `dev`. A separate `.env.production` (or the Vercel environment) points at `main`.
- **Guard it:** `scripts/backup.ts`, the test suite, and any destructive script refuse to run when `DATABASE_URL` matches the production branch, unless explicitly overridden. Same pattern as the migration guard.
- The real audit runs against `main`, once, and nothing else ever writes to it except the running app.

Note the asymmetry that makes this urgent: everything else in this project is recoverable. The real log is not.

## 2. "Shorter" means fewer lines, not fewer characters

**Severity: medium. My spec was ambiguous; this is the correction.**

`CLOSING_LINES_COMPLETE` entries are now constrained to be longer than every `CLOSING_LINES_EMPTY` entry, to satisfy a character-length test. That inverts the relationship between rule and copy: the writing is now hostage to a measurement artifact, and every future line has to be checked against the constraint.

The intent of "the report never grows in response to failure" is **structural weight** — how much the report says, not how many characters it occupies. An empty day is four lines; a complete day is five. That is the whole rule.

Required:

- Measure the guarantee in **lines**, not characters
- Remove the length ordering constraint from the copy pools
- Rewrite any line that was distorted to satisfy it

## 3. The closing line must be true, not selected

**Severity: medium. This is the more important of the two report items.**

`pickClosingLine` rotates through a fixed pool by day index. PRD §12.3 requires that the line "is omitted when nothing true can be said" — and the worked example, *"Three of the last five days ran clean"*, is a **computed statement about the log**, not a stock phrase.

A rotating pool of generic encouragement is precisely the "wallpaper within a fortnight" failure that the message budget exists to prevent. Worse, it is the product speaking without knowing anything — which is the opposite of its only real power.

Required:

- The closing line is generated from a small set of **fact rules** over the log, each producing a sentence only when its condition holds. For example: N of the last M days ran clean; first completion in this domain in N days; longest run of consecutive complete days so far; the resistance tag distribution shifted.
- If no rule fires, **there is no closing line.** Silence is correct and should be common.
- No line may be emitted that is not derived from data.
- The seven-day non-repetition rule applies to rules, not strings.

Start with three or four rules. A report that is silent four nights out of seven is working as designed.

## 4. Morning is not a clock window

**Severity: medium. Adjudicating the flagged interpretive call.**

Morning currently runs for a fixed three hours from the logical day boundary. That does not survive the user's actual schedule: sessions run past midnight, waking time varies widely, and waking at 11:00 would mean never seeing the Morning state at all — the one screen that carries the product's emotional weight.

Required:

- **Morning is shown on the first open of each logical day, whatever the clock says.** It persists until the first completion is logged, or until the user leaves it.
- After that, Day.
- Night at the user's display hour, as already built.

This is schedule-agnostic and matches the intent — 30 to 60 seconds on waking, whenever waking happens.

## 5. Also adjudicated

**Momentum qualifier in the report** ("unchanged", "improving"): derive it from `delta` against `MOMENTUM_STABLE_BAND` — the same threshold momentum itself uses. Above the band, "improving"; below, "slipping"; within it, "unchanged"; `null` delta, omit the qualifier entirely. No separate derivation, no second set of thresholds.

**Seven queries for the morning screen:** accepted. Forcing structurally different query shapes into one statement would trade clarity for a metric. The DoD item was about eliminating the five redundant full-log replays, and that is done.

## Definition of done

- Real and development databases are separate, with a guard preventing cross-writes
- Report length guarantee measured in lines; copy pools unconstrained
- Every closing line traceable to a fact rule; silence when none fires
- Morning appears on first open of a logical day regardless of clock time
- Rebuild-equivalence still passes
- Committed separately
