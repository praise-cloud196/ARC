-- Milestone 1.1: attention_events split out, corrections, recomputable
-- logical_day, conduct/instrumentation split.
-- docs/milestone-1.1-fixes.md items 1-5.
--
-- Pure ALTER/CREATE — no DROP TABLE. This migration only ever runs against
-- an empty `events` (enforced by the guard in scripts/migrate.ts, added in
-- docs/milestone-1.2-fixes.md item 1), so adding NOT NULL columns without a
-- backfill step is safe here. If that stops being true this file must not
-- be edited retroactively — a new migration handles the backfill instead.

ALTER TABLE events ADD COLUMN timezone text;
ALTER TABLE events ALTER COLUMN timezone SET NOT NULL;

-- clock_timestamp(), not now(): now() is frozen for the whole transaction,
-- which would tie two events written in the same transaction (the normal
-- case per AGENTS.md hard rule 2) and break "the latest correction wins"
-- below — recorded_at must never be equal by assumption (architecture doc
-- §2.1).
ALTER TABLE events ALTER COLUMN recorded_at SET DEFAULT clock_timestamp();

ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (type IN (
  'commitment.completed',
  'commitment.completed.corrected',
  'commitment.missed',
  'condition.logged',
  'condition.logged.corrected',
  'mark.recorded',
  'mark.recorded.corrected',
  'stance.changed',
  'life.entry_logged',
  'life.entry_logged.corrected',
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
));

-- A correction event without a subject to correct is meaningless.
ALTER TABLE events ADD CONSTRAINT events_corrected_has_subject
  CHECK (type NOT LIKE '%.corrected' OR subject_id IS NOT NULL);

CREATE INDEX events_subject_id_idx ON events (subject_id) WHERE subject_id IS NOT NULL;

CREATE OR REPLACE FUNCTION forbid_events_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- The Attention layer's log. Structurally separate from `events` — per
-- architecture-and-ux-v1.0.md §2.7, inclusion in a general aggregate must be
-- impossible, not merely avoided by convention. There is deliberately no
-- `domain` column: Attention behaviours are not domain-scored, so there is
-- nothing here for a domain-keyed aggregate to pick up even by accident.
-- Never joined into any view, rollup, or aggregate that feeds the Loop, the
-- nightly report, XP, momentum, or rank.
CREATE TABLE attention_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN (
                    'attention.event_logged',
                    'attention.event_logged.corrected'
                  )),
  occurred_at     timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  logical_day     date NOT NULL,
  timezone        text NOT NULL,
  -- The stance (behaviour) this event belongs to.
  subject_id      uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  CHECK (type NOT LIKE '%.corrected' OR subject_id IS NOT NULL)
);

CREATE INDEX attention_events_logical_day_idx ON attention_events (logical_day);
CREATE INDEX attention_events_subject_id_idx ON attention_events (subject_id) WHERE subject_id IS NOT NULL;

CREATE TRIGGER attention_events_no_update
  BEFORE UPDATE ON attention_events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

CREATE TRIGGER attention_events_no_delete
  BEFORE DELETE ON attention_events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

-- `event_count` / `domain_counts` cover conduct events only, with
-- corrections applied (the latest correction for an event supersedes the
-- original; the original row is never removed, just excluded from these
-- aggregates in favour of its correction). `instrumentation_count` is
-- separate and must never feed the Loop, the nightly report, XP, or
-- momentum — it exists only for the day-60 usage report (PRD §22).
ALTER TABLE daily_rollup ADD COLUMN instrumentation_count integer NOT NULL DEFAULT 0;
