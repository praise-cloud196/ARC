-- Milestone 4 §0.1/§3: commitments move up from milestone 5 — the Loop
-- can't display or complete anything without them.
--
-- Direction table (architecture-and-ux-v1.0.md §2.3): current state, freely
-- editable, no append-only trigger — history lives in `events` via
-- `commitment.completed` / `commitment.missed`, which reference a row here
-- by `subject_id` (the same convention as `quest.created` -> `quests.id`).
--
-- week_start is always a Monday (lib/day-math.ts's startOfWeek, matching
-- Postgres's own ISO date_trunc('week', ...) convention used by the lock
-- trigger below) — the week the commitment was declared for, not a
-- recurrence rule: renewing next week means declaring a new row.
CREATE TABLE commitments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text NOT NULL CHECK (domain IN ('career', 'body', 'attention')),
  label         text NOT NULL CHECK (label <> ''),
  tier          integer NOT NULL CHECK (tier IN (1, 2, 3)),
  weekly_target integer NOT NULL CHECK (weekly_target > 0),
  week_start    date NOT NULL,
  active_from   date NOT NULL,
  active_until  date,
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (active_until IS NULL OR active_until >= active_from)
);

CREATE INDEX commitments_week_start_idx ON commitments (week_start);

-- Weekly lock, enforced at the data layer, not application logic
-- (PRD §13, AGENTS.md hard rule 9, milestone-4-spec.md §3): "the UI must
-- not be the thing standing between the user and editing their own terms
-- mid-week." Only blocks the four declaration fields, only for the week
-- that is CURRENTLY in progress — past and future weeks are untouched by
-- this rule.
--
-- date_trunc('week', CURRENT_DATE) uses the database session's own
-- timezone, not ARC_TIMEZONE (a trigger can't read Node process config) —
-- an approximation that can drift by up to the user's UTC offset right at
-- the week boundary. Acceptable here: this trigger is a defense-in-depth
-- backstop against a raw UPDATE bypassing the app, not the primary guard —
-- lib/commitments.ts's write path is timezone-and-logical-day aware and is
-- what normal operation actually goes through.
CREATE OR REPLACE FUNCTION forbid_current_week_commitment_edit() RETURNS trigger AS $$
BEGIN
  IF OLD.week_start = date_trunc('week', CURRENT_DATE)::date
     AND (
       NEW.label IS DISTINCT FROM OLD.label
       OR NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.weekly_target IS DISTINCT FROM OLD.weekly_target
       OR NEW.domain IS DISTINCT FROM OLD.domain
     ) THEN
    RAISE EXCEPTION 'commitment declaration fields are immutable during their locked week (week_start = %)', OLD.week_start;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commitments_weekly_lock
  BEFORE UPDATE ON commitments
  FOR EACH ROW EXECUTE FUNCTION forbid_current_week_commitment_edit();

-- milestone-4-spec.md §3: "payload.tier and payload.resistance." Resistance
-- is deliberately NOT required to be present — architecture-and-ux-v1.0.md
-- §4.2: the tap completes and writes commitment.completed immediately;
-- picking a resistance option patches it in via a correction moments
-- later. Only its VALUE is validated, when given.
ALTER TABLE events ADD CONSTRAINT events_valid_resistance CHECK (
  type NOT IN ('commitment.completed', 'commitment.completed.corrected')
  OR NOT (payload ? 'resistance')
  OR payload->>'resistance' IN ('easy', 'normal', 'against_resistance')
);

-- commitment.missed (milestone-4-spec.md §6): written by the boundary job
-- only, one per commitment whose weekly_target wasn't met that week. No new
-- payload shape to validate — subject_id (already required for every event,
-- see events_corrected_has_subject... actually not required for this type,
-- see below) points at the commitments row.
ALTER TABLE events ADD CONSTRAINT events_missed_has_subject CHECK (
  type <> 'commitment.missed' OR subject_id IS NOT NULL
);
