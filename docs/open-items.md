# Open items

Kept so side conversations don't lose the thread. Update as things close.

## Pending push / check
- Unpushed commits: text collapse (`dd76188`), Morning Main Quest block (`916f25c`), Copy last week on Today/Morning (`35b35d9`), mode styling (`fe1837e`), plus the nav/links wrap fix.
- Never type-checked or run locally: everything from catch-up logging onward (Vercel's build is the only check so far).
- Migration `0011` (Mark reference check) applied to `dev`; optional on production.

## In progress now
- Visual identity of Morning / Day / Night: built, awaiting the user's reaction on a phone.

## Queued, in order
1. **Rules review** (AGENTS.md + design docs): sort each rule into keep / loosen / drop, because the voice and gamification limits may be causing the dryness. Structural rules (append-only, derived values, no AI) are not the suspects.
2. **Vocabulary review**: user finds "Character Sheet" and "Stance" unclear. Candidate relatable labels to be proposed and chosen (UI labels first; code names can stay). Also check Mark, Rank, Season, Chapter, Momentum, Probe, Undertaking, Outcome, Reference.
3. Confirmations for Notes and Metrics (Marks and commitments done).
4. Optional short title per Outcome for the Morning screen.
5. **Milestone 7**: weekly review, declare next week, season close into a Chapter, rank evaluation.

## Known caveats
- Catch-up: a completion logged after its week ended doesn't undo the `commitment.missed` already written.
- `npm test` must run in a fresh shell (a leftover production `DATABASE_URL` skips loading `.env.local` and disables the production guard).
