-- ARC schema — milestone 1.1: attention_events split out, corrections,
-- recomputable logical_day, conduct/instrumentation split.
-- architecture-and-ux-v1.0.md §2.1, §2.2, §2.4, §2.5, §2.7.
-- docs/milestone-1.1-fixes.md items 1-5.
--
-- `events` and `daily_rollup` are dropped and recreated rather than altered:
-- both are empty pre-launch, and this file is applied wholesale by
-- scripts/migrate.ts rather than as a chain of incremental migrations. Once
-- real data exists this file stops being a safe way to apply schema changes.

DROP TABLE IF EXISTS daily_rollup;
DROP TABLE IF EXISTS events;

-- The event log. Append-only, source of truth for everything that happened,
-- except the Attention layer (see `attention_events` below).
-- AGENTS.md hard rule 1: no UPDATE, no DELETE, ever — enforced below by
-- trigger, not by convention, per architecture-and-ux-v1.0.md §2.1
-- ("Invariants — these are enforced, not conventions").
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN (
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
                  )),
  occurred_at     timestamptz NOT NULL,
  -- clock_timestamp(), not now(): now() is frozen for the whole transaction,
  -- which would tie two events written in the same transaction (the normal
  -- case per AGENTS.md hard rule 2) and break "the latest correction wins"
  -- (milestone-1.1-fixes.md item 2) — recorded_at must never be equal by
  -- assumption (§2.1 above).
  recorded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  logical_day     date NOT NULL,
  -- The IANA zone `logical_day` was computed against, captured at write time
  -- so logical_day is forever recomputable from (occurred_at, timezone)
  -- without depending on whatever ARC_TIMEZONE happens to be set to later
  -- (milestone-1.1-fixes.md item 3). The stored `logical_day` column above
  -- is a cache of that computation, not the source of truth — rebuild always
  -- recomputes it from occurred_at + timezone rather than trusting it.
  timezone        text NOT NULL,
  domain          text,
  subject_id      uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  -- A correction event without a subject to correct is meaningless
  -- (milestone-1.1-fixes.md item 2).
  CHECK (type NOT LIKE '%.corrected' OR subject_id IS NOT NULL)
);

CREATE INDEX events_logical_day_idx ON events (logical_day);
CREATE INDEX events_type_idx ON events (type);
CREATE INDEX events_domain_idx ON events (domain) WHERE domain IS NOT NULL;
CREATE INDEX events_subject_id_idx ON events (subject_id) WHERE subject_id IS NOT NULL;

CREATE OR REPLACE FUNCTION forbid_events_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

CREATE TRIGGER events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION forbid_events_mutation();

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

-- Cached projection of `events`, keyed by logical day. Must be fully
-- reconstructible from events alone (architecture-and-ux-v1.0.md §2.4) —
-- this is the minimal skeleton the milestone-1 rebuild command proves out;
-- milestone 2 adds character-model columns (XP, momentum, condition).
--
-- `event_count` / `domain_counts` cover conduct events only, with
-- corrections applied (the latest correction for an event supersedes the
-- original; the original row is never removed, just excluded from these
-- aggregates in favour of its correction). `instrumentation_count` is
-- separate and must never feed the Loop, the nightly report, XP, or
-- momentum (milestone-1.1-fixes.md item 4) — it exists only for the day-60
-- usage report (PRD §22).
CREATE TABLE IF NOT EXISTS daily_rollup (
  logical_day           date PRIMARY KEY,
  event_count           integer NOT NULL,
  domain_counts         jsonb NOT NULL DEFAULT '{}'::jsonb,
  instrumentation_count integer NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now()
);
