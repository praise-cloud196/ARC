# Milestone 5 — Quests, precise spec

*Undertakings and Probes. Commitments already moved to milestone 4 (milestone-4-spec.md §0.1); Outcome creation already shipped in milestone 3 (audit step 5). This milestone is what's left of PRD §13: the two quest kinds that didn't exist yet, plus Outcome achievement.*

---

## 0. Domain scoping — resolved

PRD §8's domain table gives each scored domain a distinct primary object: Career → Probes/Undertakings, Body → Commitments/metrics, Attention → Commitments/Stances. Career appears nowhere else in that table.

**Resolution: Undertakings and Probes are Career-only in v1.** Every quest of either kind is written with `domain = 'career'` in its events; there is no domain picker in either creation form. This keeps the domain table's 1:1 mapping literal rather than blurring it — reopen this if it turns out to be too narrow once the Ritual (milestone 7) is actually reviewing seasons.

Outcomes remain domain-agnostic, as milestone 3 already built them (they're not scored, so the question doesn't apply).

## 1. Schema

`quests` currently: `id, kind ('outcome' only), statement, status ('active'|'achieved'|'abandoned'), created_at`.

Extend, migration `0010_undertakings_probes.sql`:

- `kind` CHECK widens to `'outcome' | 'undertaking' | 'probe'`.
- `status` CHECK becomes kind-conditional: outcome → `active|achieved|abandoned`; undertaking → `active|completed|abandoned`; probe → `active|folded|abandoned`.
- `decision_date date`, `signal text` — both NULL unless `kind = 'probe'`, both required (`signal <> ''`) when it is. Declared once, at creation, and never optional for a Probe (PRD §13: "neither is optional").
- No `domain` column. Per §0, Undertaking/Probe domain is always `'career'` and lives only on the events, the same way Outcome's lack of a domain column already reflects "not domain-scoped" rather than storing a redundant constant.
- No `steps` column, no separate steps table. An Undertaking's steps are not a pre-declared checklist — PRD §13 doesn't specify a fixed count, and AGENTS.md hard rule 4 rules out inventing one. Steps are ordinary `quest.step_completed` events against the Undertaking's `id`, added one at a time as work happens; "ordered" means ordered by `recorded_at`, the log's own gapless order, not a stored sequence number. This mirrors how a Commitment's weekly count is never stored on the commitment row either — the log is the count.
- No `extended` column. "Extend permitted once only" (PRD §13) is answered by querying prior `probe.resolved` events with `payload.action = 'extend'` for that quest id, not a stored flag — AGENTS.md hard rule 3, derived from the log.
- **Max active per kind, enforced by trigger** (same pattern as `commitments_weekly_lock`): 3 active Undertakings, 2 active Probes (PRD §13). The two numbers live in `lib/calibration.ts` as `QUEST_MAX_ACTIVE_UNDERTAKINGS` / `QUEST_MAX_ACTIVE_PROBES`; the trigger hardcodes the same two numbers with a comment pointing at calibration.ts, since a CHECK/trigger can't import TypeScript (the same limitation `0005_valid_xp_tier.sql` already documents and accepts).

## 2. Event types

Already reserved in `lib/events.ts`'s `EVENT_TYPES` since milestone 1 planning: `quest.step_completed`, `quest.abandoned`, `probe.resolved`, `outcome.achieved`. None had a write path. This milestone adds one each, plus:

- `quest.step_completed.corrected` — new. Step completion is **conduct** (design-revision-v2.md §7.1, same category as `commitment.completed`): voidable same logical day only, never edited otherwise. `0009_void_completion.sql`'s own comment already flagged this gap ("Add it here when that milestone gives it a correction path") — this migration does that: adds `quest.step_completed` to `CORRECTABLE_EVENT_TYPES` and to `events_valid_voided`'s type list.
- `probe.resolved` payload: `{ action: 'double_down' | 'fold' | 'extend', note?: string }`. `note` is **required when `action = 'fold'`** (PRD §13: "required note on what was learned"), optional otherwise. New CHECK, same idiom as `events_valid_resistance`.
- `quest.step_completed`, `quest.abandoned`, `probe.resolved`, `outcome.achieved` all require `subject_id` (the quest row they act on) — same idiom as `events_missed_has_subject`.
- `quest.step_completed`'s `payload.tier` is already covered by `0005_valid_xp_tier.sql`, which explicitly lists this type.

## 3. Undertakings

- Create: statement (the project), tier is **not** fixed at creation — each step carries its own tier, since steps within one project can vary in size. Max 3 active, enforced by §1's trigger.
- Add a step: writes `quest.step_completed` with `subject_id` = the Undertaking's id, `payload.tier`. Awards XP via `XP_TIER_VALUES[tier]` to the `career` domain — `lib/xp.ts`'s `XP_EVENT_TYPES` already includes this type, so nothing changes there.
- Complete the Undertaking: a separate, explicit action (not implied by adding a step) — sets `status = 'completed'`, writes nothing to the event log beyond `quest.abandoned`'s sibling... no: completion needs its own signal. Use `quest.step_completed`'s sibling event is wrong; instead completion is recorded by the status change itself plus an optional Mark (below). No new event type is needed for "the undertaking is done" beyond the `quests.status` transition — the direction table already carries current state, and the step history is what's permanent. (If a discrete "undertaking completed" fact ever needs to be replayed from the log alone, add `quest.completed` in a later migration; not required for milestone 5's definition of done.)
- **Completion may generate a Mark** (PRD §13): the completion form has an optional note field. If filled in, `recordMark` is called with `sourceQuestId` = the Undertaking's id, domain `career`.

## 4. Probes

- Create: statement, `decisionDate`, `signal` — both blocking, per §1. Max 2 active.
- **Needs resolution** when `status = 'active'`, `decision_date <= today`, and no `probe.resolved` event exists for this quest whose `recorded_at` is after the quest's *current* `decision_date` — this is why `extend` (which moves `decision_date` forward) correctly makes the probe stop needing resolution until the new date, while `double_down` (which doesn't move it) is satisfied by the existence of the resolution event itself. Computed at read time, not stored.
- Resolve with `double_down`: writes `probe.resolved` (`action: 'double_down'`). `status` stays `active`, `decision_date` unchanged.
- Resolve with `fold`: writes `probe.resolved` (`action: 'fold'`, `note` required). Sets `status = 'folded'`. **This is a successful close**, not a failure — nothing in the UI may frame it as one (PRD §13).
- Resolve with `extend`: requires a new `decisionDate` in the future. Rejected if a prior `probe.resolved` with `action = 'extend'` already exists for this quest (§1 — checked against the log, not a stored flag). Writes `probe.resolved` (`action: 'extend'`), updates `quests.decision_date`.

## 5. Outcomes — achievement

`recordOutcome` (milestone 3) already covers creation. Add:

- `achieveOutcome`: sets `status = 'achieved'`, writes `outcome.achieved` (`subject_id` = the Outcome's id) — "a major history event" (PRD §13). Requires a domain (Outcomes themselves aren't domain-scoped, but the Mark it generates must be, same as any other Mark) and a note, and always writes the accompanying Mark via `recordMark` with `sourceQuestId` set — "On achievement, converts to a Mark" is not optional the way an Undertaking's is.
- `abandonQuest`: generic across all three kinds (outcome/undertaking/probe) — sets `status = 'abandoned'`, writes `quest.abandoned`. Never deletes the row (architecture doc §9: "Abandoning a quest appends an abandonment event; it never removes the quest... from the record").

## 6. Mark's source quest

PRD §9 lists `source quest (optional)` as one of Mark's fields; `lib/marks.ts` doesn't have it yet. Add `sourceQuestId?: string` to `RecordMarkInput`, stored as `payload.sourceQuestId` when present. No FK/CHECK enforcement — same trust level as `artifact`.

## 7. UI

New route `/quests`, reached the same way Marks/Metrics/Notes/Stances are — a link from the character sheet, `BackLink` back to it, not in the persistent `Nav` (it isn't a daily action).

Four sections, per architecture-and-ux-v1.0.md §4.4:

- **Commitments** — not rebuilt here; a short summary line plus a link out to `/commitments`, which already owns declaration and the weekly lock.
- **Undertakings** — creation form (statement only); each active Undertaking as a grid cell showing its statement and step count, with an "Add step" form (tier picker) and a "Complete" action (optional note → Mark) inline.
- **Probes** — creation form (statement, decision date, signal — all required, submit blocked otherwise). Each active Probe as a grid cell showing statement/decision date/signal. A Probe needing resolution (§4) shows its three actions (Double down / Fold / Extend) with **identical visual weight** (PRD §13, architecture doc §4.4) — no default button styling that makes one read as the "expected" choice.
- **Outcomes** — existing list (already on the character sheet) plus, per Outcome, "Achieved" and "Abandon" actions.

**Morning screen.** Per architecture-and-ux-v1.0.md §4.4: a Probe needing resolution gets a card on the Morning screen, staying there until resolved. Add `probesAwaitingResolution` to `MorningScreenData` / `computeMorningScreenData`; render below the existing content, same fold/double-down/extend actions as the Quests screen (not a simplified version — this is the one place PRD §12.1's "nothing else" rule is already known to bend, since architecture doc §4.4 specifies it explicitly).

## 8. Definition of done

- Undertakings: create, add steps (each awarding XP to `career`), complete with optional Mark. Max 3 active enforced at the data layer.
- Probes: create with blocking decision date + signal. Resolve via double down / fold / extend, fold requires a note and is never framed as failure, extend blocked on a second attempt, both checked against the log. Max 2 active enforced at the data layer.
- A Probe past its decision date and unresolved appears on the Morning screen and stays until resolved.
- Outcomes: achieve (always produces a Mark) and abandon, alongside existing creation.
- `quest.step_completed` is voidable same-day, like `commitment.completed`.
- Rebuild-equivalence still passes with Undertaking/Probe/Outcome events present.
- No screen introduces a domain picker for Undertakings or Probes — always `career`.
