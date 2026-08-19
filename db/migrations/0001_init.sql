-- Milestone 1: event log + rebuildable rollup.
-- architecture-and-ux-v1.0.md §2.1, §2.2, §2.4.

-- The event log. Append-only, source of truth for everything that happened.
-- AGENTS.md hard rule 1: no UPDATE, no DELETE, ever — enforced below by
-- trigger, not by convention, per architecture-and-ux-v1.0.md §2.1
-- ("Invariants — these are enforced, not conventions").
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN (
                    'commitment.completed',
                    'commitment.missed',
                    'condition.logged',
                    'mark.recorded',
                    'stance.changed',
                    'attention.event_logged',
                    'life.entry_logged',
                    'day.reported',
                    'app.opened',
                    'quest.created',
                    'quest.step_completed',
                    'quest.abandoned',
                    'probe.resolved',
                    'outcome.achieved',
                    'season.opened',
                    'season.closed',
                    'recovery.started',
                    'return.detected'
                  )),
  occurred_at     timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  logical_day     date NOT NULL,
  domain          text,
  subject_id      uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE
);

CREATE INDEX events_logical_day_idx ON events (logical_day);
CREATE INDEX events_type_idx ON events (type);
CREATE INDEX events_domain_idx ON events (domain) WHERE domain IS NOT NULL;

CREATE OR REPLACE FUNCTION forbid_events_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

CREATE TRIGGER events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

-- Cached projection of the event log, keyed by logical day. Must be fully
-- reconstructible from events alone (architecture-and-ux-v1.0.md §2.4) —
-- this is the minimal skeleton the milestone-1 rebuild command proves out;
-- milestone 2 adds character-model columns (XP, momentum, condition).
CREATE TABLE daily_rollup (
  logical_day   date PRIMARY KEY,
  event_count   integer NOT NULL,
  domain_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at   timestamptz NOT NULL DEFAULT now()
);
