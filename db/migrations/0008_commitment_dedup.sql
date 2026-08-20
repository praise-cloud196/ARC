-- Found via browser testing (milestone-4-spec.md build): submitting the
-- commitments declaration form once produced two identical rows — the
-- browser environment double-submitted the POST. Every event write in this
-- codebase already tolerates a double tap via idempotency_key
-- (architecture-and-ux-v1.0.md §2.6 — "the normal case, not an edge case");
-- lib/commitments.ts's declareCommitment had no equivalent protection for
-- the direction-table row it inserts. A UNIQUE constraint is the direct
-- fix here — unlike a completion, declaring the identical commitment
-- (domain, label, week) twice has no meaningful "twice" to represent.
ALTER TABLE commitments ADD CONSTRAINT commitments_unique_declaration UNIQUE (week_start, domain, label);
