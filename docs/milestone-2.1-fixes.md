# Milestone 2.1 — three corrections

*Review of milestone 2. Items 1 and 2 must be resolved before milestone 3, because milestone 3 is when the log stops being empty and both become expensive.*

Milestone 2 is otherwise correct. `computeMomentum` implements §3.2 and §3.3 exactly, and the decision to let undefined rates fall through to Holding via null checks — rather than special-casing each edge — is better than the spec it was written from.

---

## 1. A correction can take away a level

**Severity: high. Violates AGENTS.md hard rule 12.**

`levelForXp` carries a comment stating that callers "must never feed this a lower xp than previously observed." That invariant is not enforceable, because it is not true: XP is derived from the event log, corrections can change `payload.tier`, and a correction from tier 3 to tier 1 reduces domain XP by 40. If that crosses a threshold, the domain level drops.

Nothing built is ever taken away. That includes being taken away by the user's own honesty in correcting a mis-logged entry — which is precisely the behaviour the correction mechanism exists to encourage.

Required:

- **Domain level is a high-water mark.** Compute it by replaying conduct events in `occurred_at` order, tracking running XP, and taking the maximum level reached at any point — not the level implied by the current total.
- This remains fully derived from the log, so rebuild-equivalence still holds.
- Current XP may fall after a correction. That is fine and should display honestly. The *level* does not follow it down.
- Replace the comment-based invariant with a test: log tier-3 completions to reach level 3, correct one down to tier 1, assert XP decreased and level did not.

## 2. Validate `payload.tier` at write time, not read time

**Severity: medium.**

`computeDomainXp` throws when an XP-bearing event has no valid `payload.tier`. On an append-only table this means a single malformed event permanently breaks the character sheet — and it cannot be deleted, only corrected, which requires the app to be working well enough to correct it.

A read path that renders the morning screen must not be capable of being poisoned by one bad row.

Required:

- Add a DB-level CHECK on `events`: when `type IN ('commitment.completed', 'quest.step_completed')`, `payload->>'tier'` must be present and one of the valid tier values. Apply to the corresponding `.corrected` types too.
- Once the write path cannot produce an invalid event, the read path's throw becomes unreachable — keep it as an assertion, but it should never fire.
- The same principle applies to every future event type: **validate at write, never throw at read.** Worth adding to AGENTS.md.

## 3. Full log scan per domain

**Severity: low. Note, not a blocker.**

`computeDomainXp` calls `resolveEffectiveEvents(client)`, which loads the entire event log, and is called once per domain — four full scans to render one screen. Correct, and fine at current volume, but the pattern will be copied as more derived values arrive in milestones 4–7.

Required by milestone 4, not now:

- A single pass that resolves effective events once and computes all per-domain values from it, or a windowed query that reads only what the surface needs
- The morning screen has a three-minute budget for the whole Loop; it should not be doing four full-table scans to draw itself

---

## Also before milestone 3

Milestone 3 writes the first real events. Two things should be in place before it does:

- **Scheduled `pg_dump` to a file you keep.** Neon's point-in-time restore is measured in days; the failure mode that would actually hurt is corruption noticed in month three. The event log is the one asset in this project that cannot be regenerated.
- **Retention window recorded in the README**, once checked in the Neon console.

## Definition of done

- Correcting a completion downward reduces XP and does not reduce level, proven by test
- An event with an invalid tier cannot be inserted
- Backup in place before the baseline audit runs
- Rebuild-equivalence still passes
- Committed separately
