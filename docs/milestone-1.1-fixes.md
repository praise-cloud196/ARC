# Milestone 1.1 — corrections before milestone 2

*Review of milestone 1 against `docs/architecture-and-ux-v1.0.md` and `docs/PRD-v1.0.md`. All five items must be complete before milestone 2 begins. Four of them are only cheap while the tables are empty.*

Milestone 1 is otherwise sound: the append-only triggers are real and enforced at the database, idempotency is correct, the `pg` date-parser fix and the removal of the TLS bypass were both right calls.

---

## 1. Split the Attention layer into its own table

**Severity: high. Blocks milestone 2.**

Architecture §2.7 requires `attention_events` as a **separate table**, specifically so that inclusion in a general aggregate is structurally impossible rather than dependent on remembering to exclude a type.

Current state: `attention.event_logged` sits in the shared `events` table, and `daily_rollup.domain_counts` already counts it. Milestone 2 builds XP and momentum on top of that rollup, so the leak propagates into the character model.

Required:

- New table `attention_events`, same append-only triggers as `events`
- Remove `attention.event_logged` from the `events` type CHECK
- `attention_events` is never joined into any view, rollup, or aggregate that feeds the Loop, the nightly report, XP, momentum, or rank
- Stances with status `not_now` are filtered at the query layer so the behaviour cannot surface anywhere (PRD §16)

## 2. Add correction event types

**Severity: high. Blocks any real data entry.**

Architecture §2.1: *"A correction is a new event of type `*.corrected` referencing the original."* No such type exists in the CHECK constraint. Combined with the append-only triggers, the first mistyped entry is permanent with no available remedy.

Required:

- Add correction types to the CHECK constraint. Minimum set for v1: `commitment.completed.corrected`, `condition.logged.corrected`, `mark.recorded.corrected`, `attention.event_logged.corrected` (on `attention_events`), `life.entry_logged.corrected`
- A correction event carries `subject_id` = the id of the event it corrects, and the corrected values in `payload`
- All readers and rollups must apply corrections: the latest correction for an event supersedes the original. The original is never removed.
- Extend `tests/rebuild-equivalence.test.ts` to cover a corrected event

## 3. Make `logical_day` recomputable

**Severity: high. Irreversible if left.**

`logical_day` is computed at write time from `ARC_TIMEZONE` and stored in an append-only table. If the timezone is wrong — and the current default, `America/New_York`, is a guess — every day is permanently mislabeled, and correcting it would require mutating history.

Required:

- Set `ARC_TIMEZONE` to the correct IANA zone in `.env.local` **and** change the fallback in `lib/logical-day.ts` from a guessed default to throwing on absence. A wrong timezone must fail loudly, not silently.
- Add `timezone text NOT NULL` to `events` and `attention_events`, populated at write time
- `logical_day` becomes derivable from `occurred_at` + `timezone` on the row, so a mistake is recoverable by recomputing the rollup rather than by editing history
- Update `.env.local.example` to remove the `America/New_York` example value — an example value that works is an example value that ships

## 4. Separate instrumentation from conduct in the rollup

**Severity: medium. Blocks milestone 2.**

PRD §22: self-instrumentation *"is for evaluating the product, is never displayed as a score, and never appears in the Loop."* Currently `app.opened` counts into the same `event_count` and `domain_counts` as real activity.

Required:

- The rollup distinguishes conduct events from instrumentation events. `app.opened` and `day.reported` are instrumentation.
- No aggregate that feeds the Loop, the report, XP, or momentum may include instrumentation
- Instrumentation counts remain available for the day-60 usage report

## 4b. Timezone and boundary values, and the report timing

**Severity: medium. Design change, not a defect.**

The user works overnight; sessions regularly finish after midnight and sometimes into early morning. Two consequences:

**Timezone and boundary.** `ARC_TIMEZONE=Africa/Lagos`. `LOGICAL_DAY_BOUNDARY_HOUR = 6` rather than 4 — a session finishing at 5am belongs to the day that is ending, not the one beginning. This is exactly the tunability that justifies item 5.

**The nightly report must not be generated at a fixed hour.** PRD §12.3 assumed a user-set report hour. For an overnight schedule any fixed hour either fires while work is still in progress (producing a report that is wrong by morning) or fires after the boundary has already closed the day.

Required instead:

- The report is **computed on demand from the log for the current logical day**, and is final once the boundary passes
- The `Today` surface switches to its night state at a user-set display hour. That hour is a presentation choice only — it must not act as a data cutoff.
- The only scheduled job remains the boundary-time `commitment.missed` writer and the rollup

This is simpler than the original design as well as more correct: one fewer setting, and no window in which the report and the log disagree.

## 5. Move the logical day boundary hour into calibration

**Severity: low. Correct the pattern, not just the line.**

`LOGICAL_DAY_BOUNDARY_HOUR` lives in `lib/logical-day.ts` with a written argument that AGENTS.md hard rule 4 governs progression constants and not clock semantics. The argument is plausible, but the boundary hour buckets days, and day buckets feed momentum — it is tunable and belongs with the other tunable values.

Required:

- Move `LOGICAL_DAY_BOUNDARY_HOUR` to `lib/calibration.ts`
- Amend AGENTS.md hard rule 4 to read: *"No numeric literal governing system behaviour may appear outside `lib/calibration.ts`."* An agent should not be able to reason its way out of this rule.

---

## Definition of done

- `npm run build` clean
- Rebuild-equivalence test passes, including a corrected event
- A grep for numeric literals outside `lib/calibration.ts` finds nothing governing behaviour
- `attention_events` cannot be reached from any Loop-facing query
- Committed separately from the milestone 1 snapshot
