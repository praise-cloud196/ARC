-- Milestone 2.1 item 2: validate payload.tier at write time, not read time.
-- docs/milestone-2.1-fixes.md item 2 — computeDomainXp / computeDomainLevel
-- (lib/xp.ts) threw when an XP-bearing event had no valid payload.tier. On
-- an append-only table that means one malformed event permanently breaks
-- every read of the character sheet, and it can't be deleted — only
-- corrected, which requires the app to already be working well enough to
-- write the correction. Closing the write path instead means the read-time
-- throw becomes unreachable, kept only as a defensive assertion.
--
-- Tier values (1, 2, 3) must match the keys of XP_TIER_VALUES in
-- lib/calibration.ts (AGENTS.md hard rule 4) — a CHECK constraint can't
-- import that, so if the tiers there ever change, this constraint has to
-- change with it, by a new migration.
--
-- Covers commitment.completed, quest.step_completed, and
-- commitment.completed.corrected. quest.step_completed has no `.corrected`
-- variant in the type CHECK yet (lib/events.ts CORRECTABLE_EVENT_TYPES
-- doesn't include it) — nothing to cover until milestone-2-spec.md's quest
-- work adds one, at which point this constraint needs a new migration too.
-- `payload ? 'tier'` (jsonb key-exists), not just `payload->>'tier' IN (...)`:
-- when the key is absent, `payload->>'tier'` is SQL NULL, `NULL IN (...)`
-- evaluates to NULL rather than false, and a CHECK constraint treats a NULL
-- result as satisfied — a missing tier would otherwise pass silently.
ALTER TABLE events ADD CONSTRAINT events_valid_xp_tier CHECK (
  type NOT IN ('commitment.completed', 'commitment.completed.corrected', 'quest.step_completed')
  OR (payload ? 'tier' AND payload->>'tier' IN ('1', '2', '3'))
);
