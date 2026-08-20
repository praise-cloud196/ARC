# AGENTS.md — ARC

Instructions for agents working in this repository. Read fully before writing code.

## What this is

ARC is a single-user personal progression system. It measures **agency** — the developing capacity to deliberately choose what you do — across four life domains, and produces a permanent record of who the user is becoming.

It is **not** a habit tracker with RPG graphics. The game layer exists to make the record worth keeping. The record is the product.

Reference documents, in precedence order:

1. `docs/PRD-v1.0.md` — authoritative on behaviour
2. `docs/architecture-and-ux-v1.0.md` — authoritative on structure
3. `docs/philosophy-and-mechanics-v0.2.md` — authoritative on intent when the other two are silent
4. `docs/mvp-scope-v0.1.md` — authoritative on what is deliberately excluded from v1

If these conflict, the higher-numbered precedence wins and the conflict should be reported rather than resolved silently.

## Hard rules

Violating any of these is a defect regardless of whether tests pass.

1. **The event log is append-only.** No UPDATE, no DELETE on `events`. Corrections are new events. There is no exception for fixing mistakes.
2. **Conduct is written before projections**, in the same transaction.
3. **Derived values are computed from the log**, never stored as authoritative counters. The `rebuild` command must reproduce identical state.
4. **No numeric literal governing system behaviour may appear outside `lib/calibration.ts`.** XP values, level costs, momentum thresholds, dormancy, tenure, clock semantics (e.g. the logical day boundary hour), thresholds of any kind.
5. **XP must stay removable.** Nothing in momentum, rank, Marks, history, or the nightly report may read XP or level values.
6. **No day counters, streaks, or "clean since" dates anywhere in the product.** Especially in the Attention layer. Rolling density only.
7. **No AI. No model SDK in the dependency tree.**
8. **No notifications. No push infrastructure.** The only background job is the nightly rollup.
9. **Weekly commitment immutability is enforced at the data layer**, not in the UI.
10. **Stances set to `not_now` are filtered at the query layer** and must not be able to surface anywhere.
11. **The Attention layer never appears** on the morning screen, in the nightly report, or in any XP or momentum calculation.
12. **Nothing built is ever taken away.** No mechanic may reduce XP, levels, Marks, or history. Only momentum and condition move downward.
13. **Validate at write time, never throw at read time.** The event log is append-only and a bad row can't be deleted, only corrected — which requires the app to already be working well enough to write the correction. A read path that renders a screen must not be capable of being poisoned by one malformed event. Enforce shape (e.g. a `payload` field's required presence/values for a given `type`) with a DB-level CHECK before the row can ever be inserted; a throw remaining in a read path afterward is a defensive assertion that should never fire, not real validation (milestone-2.1-fixes.md item 2).

## Vocabulary

Use these names in code, database, and copy. Do not invent synonyms.

`Domain` · `Identity` · `Momentum` · `Condition` · `XP` · `Mark` · `Rank` · `Season` · `Chapter` · `Commitment` · `Undertaking` · `Probe` · `Outcome` · `Stance` · `Reference`

Never use: *task, streak, habit, goal, guild, level (global), badge, achievement, points, score.*

## Copy rules

The system's voice is flat, terse, factual. It states what happened. It does not console, exhort, congratulate, or interpret feelings.

- No exclamation marks
- No second-person encouragement ("you've got this", "great job", "keep it up")
- No inference about the user's emotional state
- Reference register: **"Day incomplete. Progress continues."**
- The nightly report never grows in response to failure — length follows activity
- The closing framing line is omitted when nothing true can be said

Copy is part of the product, not decoration. Do not improvise it. If a string isn't specified in the PRD, write it in the register above and flag it for review.

## Things that will be suggested and must be refused

These have been considered and rejected. Do not add them, do not propose them, do not leave TODOs for them:

Classes · skill trees · unlocks · boss battles as an object · guild terminology · streaks · a global level · inventory · currency · leaderboards · social features · sharing · AI coaching · health integrations · push notifications · gamified onboarding · daily login rewards · anything that increases the daily loop beyond three minutes.

## Scope discipline

The daily loop has a three-minute budget. Any feature that doesn't fit belongs in the weekly Ritual or does not exist. When adding to the `Today` surface, the default answer is no.

Build in milestone order (`docs/architecture-and-ux-v1.0.md` §5). Milestones 1–4 are the smallest livable product; do not begin 5 until 4 is usable end to end.

## Setup notes

- Stack is fixed: Next.js (App Router) + TypeScript + Tailwind, Postgres on Neon, deployed to Vercel, installable as a PWA. Do not substitute.
- The Neon connection string goes in `.env.local` as `DATABASE_URL` and is never committed.
- Single user. Do not build user management, registration, or account recovery.

## Testing

Minimal by design. Two things must be tested:

1. **Rebuild equivalence** — dropping all rollups and recomputing from `events` produces identical state
2. **Weekly lock enforcement** — a commitment in the current week rejects definition writes at the data layer

Everything else is verified by using the product.

## When uncertain

State the ambiguity and stop. Do not resolve product questions by choosing a plausible default — the design has non-obvious reasons behind most of its choices, and a reasonable-looking guess is more likely to break an invariant than an obvious one.
