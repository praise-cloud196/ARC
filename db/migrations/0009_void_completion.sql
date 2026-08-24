-- design-revision-v2.md §7: nothing in the product could be voided or
-- edited, which makes every mis-tap and every typo permanent. The fix is
-- general: a `*.corrected` event carrying `payload.voided = true` (§7.2)
-- withdraws the original without removing it — the record shows what
-- happened and that it was withdrawn, which is the honest version.
--
-- Two categories (§7.1): conduct (commitment.completed, quest.step_completed)
-- is voidable same logical day only, enforced in the application layer
-- (lib/commitments.ts's voidCommitmentCompletion) since it depends on the
-- clock, not just the row's own shape. Records (metric.recorded,
-- note.recorded, mark.recorded, life.entry_logged) are correctable or
-- voidable at any time — no such gate applies to them.
--
-- quest.step_completed is deliberately absent below: it has no
-- `.corrected` variant at all yet (lib/events.ts's CORRECTABLE_EVENT_TYPES
-- doesn't include it, same gap 0005_valid_xp_tier.sql already noted) —
-- Undertakings/Probes are milestone 5, unbuilt, so nothing can write one
-- to void. Add it here when that milestone gives it a correction path.
--
-- This constraint covers the shape of `voided` itself, for every type
-- that does have one, the same way events_valid_resistance
-- (0007_commitments.sql) already covers `resistance`: when present, must
-- be exactly `true` — "not voided" is the absence of the key, not a
-- false-y placeholder, so a stray `voided: false` can't be written and
-- later mistaken for meaningful data.
ALTER TABLE events ADD CONSTRAINT events_valid_voided CHECK (
  type NOT IN (
    'commitment.completed', 'commitment.completed.corrected',
    'metric.recorded', 'metric.recorded.corrected',
    'note.recorded', 'note.recorded.corrected',
    'mark.recorded', 'mark.recorded.corrected',
    'life.entry_logged', 'life.entry_logged.corrected'
  )
  OR NOT (payload ? 'voided')
  OR payload->>'voided' = 'true'
);
