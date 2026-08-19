# Milestone 2 — Character model, precise spec

*Resolves ambiguities in PRD §10 that would otherwise be resolved by guesswork. Where this document and PRD §10 differ, this document wins and the PRD should be amended.*

Milestone 2 covers: domains, XP, domain levels, momentum, condition, dormancy. Everything computed from the event log; nothing stored as an authoritative counter.

---

## 1. XP

XP is derived at read time from conduct events. It is never stored as a running total.

Sources of XP:

| Event | XP |
|---|---|
| `commitment.completed` | `XP_TIER_VALUES[tier]` of the commitment |
| `quest.step_completed` | `XP_TIER_VALUES[tier]` of the step |

Nothing else awards XP. Specifically: `mark.recorded` awards **zero** (PRD §14 — Marks are a separate, higher currency), and `attention_events`, `life.entry_logged`, `app.opened`, `day.reported`, `condition.logged` award zero.

Corrections apply: a superseded event contributes nothing, its correction contributes instead.

**Structural requirement (AGENTS.md rule 5):** XP is computed in one module that nothing else depends on. Momentum, rank, Marks, history and the report must not import it.

## 2. Domain levels

**The current implementation is ambiguous and probably wrong.** `levelCost(n)` returns `100 + 50(n-1)` and is documented as "cumulative XP required to reach level n" — which would put level 10 at 550 XP, reachable in about a week. That is not the intent.

Correct reading: `levelCost(n)` is the cost **of** level n, and the curve is the running sum.

```
levelCost(n)        = LEVEL_COST_BASE + LEVEL_COST_INCREMENT * (n - 1)
xpToReachLevel(n)   = Σ levelCost(k) for k = 1 .. n-1
                    = LEVEL_COST_BASE * (n-1) + LEVEL_COST_INCREMENT * (n-1)(n-2) / 2
```

So with the provisional constants: level 2 at 100, level 5 at 700, level 10 at 2,700, level 12 at 3,850.

Required:

- Rename or re-document `levelCost` so the distinction is unmissable
- Add `xpToReachLevel(n)` and `levelForXp(xp)` to `lib/calibration.ts`
- Unit test: `levelForXp(xpToReachLevel(n))` returns `n` for n = 1..30

Levels are per-domain. **There is no global level.** Levels never decrease.

## 3. Momentum

PRD §10's table is not deterministic — "Building" and "Strong" overlap, and the first two weeks have no prior period to compare against. This is the resolved specification.

### 3.1 Completion rate

Over a window of `MOMENTUM_WINDOW_DAYS` (14):

```
expected_c  = weekly_target(c) * (days c was active in window / 7)
completed_c = min(count of completions of c in window, expected_c)
rate        = Σ completed_c / Σ expected_c
```

Two rules that matter:

- **`completed_c` is capped at `expected_c`.** Overshooting one commitment must not mask missing others.
- Commitments not yet created, or created mid-window, are prorated by days active. A commitment declared yesterday does not drag the rate down for the previous thirteen days.
- If `Σ expected_c` is zero (no commitments in the window), rate is undefined — see §3.3.

`rate_current` uses the trailing 14 days; `rate_prior` uses the 14 days before that. `delta = rate_current − rate_prior`.

### 3.2 State selection — evaluate in this order, first match wins

| Order | State | Condition |
|---|---|---|
| 1 | **Dormant** | No conduct events in `MOMENTUM_DORMANT_INACTIVITY_DAYS` (7) |
| 2 | **Strong** | `rate_current ≥ MOMENTUM_STRONG_COMPLETION_RATE` (0.8) |
| 3 | **Building** | `delta > MOMENTUM_STABLE_BAND` |
| 4 | **Slipping** | `delta < −MOMENTUM_STABLE_BAND` |
| 5 | **Holding** | everything else |

Add `MOMENTUM_STABLE_BAND = 0.05` to calibration.

Order is deliberate. Checking **Strong** before **Slipping** means a week at 95% following a week at 100% reads as *Strong*, not *Slipping* — consistent with the design law that nothing built is taken away over a small dip. Checking **Building** before **Slipping** is irrelevant (they are mutually exclusive) but keeps the table readable.

### 3.3 Edge cases — all must be handled explicitly

| Situation | Result |
|---|---|
| No prior period yet (first 14 days of use) | `delta` undefined. Skip rows 3 and 4: Dormant → Strong → Holding. |
| No commitments in current window | Rate undefined. Momentum reports **Holding**. Never Slipping — the user cannot fail commitments they were not asked to make. |
| No commitments in prior window but some in current | `delta` undefined. Skip rows 3 and 4. |
| Recovery Phase active | Rate computed against the reduced commitment set only. |
| Attention events only, no commitments completed | Does **not** count as conduct for the Dormant check. Attention data never feeds momentum. |

### 3.4 What counts as conduct for the Dormant check

`commitment.completed`, `quest.step_completed`, `mark.recorded`, `condition.logged`, `life.entry_logged`.

Explicitly excluded: `app.opened`, `day.reported`, everything in `attention_events`. **Opening the app is not activity.** A user who opens it every day for a week without doing anything is Dormant, and the product should say so.

## 4. Condition

Two 3-point scales, logged by one tap each, via `condition.logged`:

- `sleep`: `short` | `normal` | `long`
- `energy`: `low` | `normal` | `high`

Never scored. Never aggregated into a number. Never labelled good or bad in any copy. Feeds the nightly report as a plain statement of fact, and is retained for pattern detection when that ships.

At most one condition per logical day; a second write for the same day is a correction, not a duplicate.

## 5. Dormancy

A domain with no conduct events in that domain for `DOMAIN_DORMANCY_DAYS` (21) enters a dormant display state. No XP loss, no level loss, no penalty of any kind. It is a fact rendered, not a consequence applied.

Note the two different windows: 7 days for **momentum** Dormant (whole-character), 21 days for **domain** dormancy. Both are calibration constants and must not be conflated.

## 6. Rank

Milestone 2 stores and displays the current rank only. **Rank never changes in milestone 2** — promotion is evaluated at season close (milestone 7). Starting rank comes from the baseline audit (milestone 3); until then, read it from config.

Rank never decreases, under any condition.

## 7. Identity

Composed for display from: rank, per-domain levels, count of Marks, and tenure (days since the first event in the log). Nothing in Identity may decrease.

## 8. Definition of done

- All XP, level and momentum values computed from the event log; no authoritative counters in any table
- `levelForXp(xpToReachLevel(n)) === n` for n = 1..30
- Every row of the §3.3 edge-case table has a test
- Momentum returns Holding, never Slipping, when no commitments exist
- `app.opened` cannot influence momentum, XP, levels, or dormancy
- Deleting the XP module breaks only XP display
- Rebuild-equivalence still passes
