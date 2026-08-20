-- ARC schema — reference snapshot of current state, generated from
-- db/migrations/*.sql. Not executed by anything: `npm run migrate` applies
-- the numbered migration files directly (docs/milestone-1.2-fixes.md item
-- 1). If you change the schema, add a new migration file — do not edit this
-- file and expect it to take effect, and keep this file in sync by hand
-- when you do.
--
-- architecture-and-ux-v1.0.md §2.1, §2.2, §2.4, §2.5, §2.7.

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
                    'life.entry_logged',
                    'life.entry_logged.corrected',
                    -- Peers by design (PRD §9), zero XP either way — see
                    -- lib/xp.ts's XP_EVENT_TYPES, which reads neither.
                    'metric.recorded',
                    'metric.recorded.corrected',
                    'note.recorded',
                    'note.recorded.corrected',
                    -- Marks the end of onboarding. Written once (see
                    -- events_audit_completed_once below) — no `.corrected`
                    -- variant, like the other one-time boundary events.
                    'audit.completed',
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
  -- below — recorded_at must never be equal by assumption (§2.1 above).
  recorded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  logical_day     date NOT NULL,
  -- The IANA zone `logical_day` was computed against, captured at write time
  -- so logical_day is forever recomputable from (occurred_at, timezone)
  -- without depending on whatever ARC_TIMEZONE happens to be set to later.
  -- The stored `logical_day` column above is a cache of that computation,
  -- not the source of truth — rebuild always recomputes it from occurred_at
  -- + timezone rather than trusting it.
  timezone        text NOT NULL,
  domain          text,
  subject_id      uuid,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  -- A correction event without a subject to correct is meaningless.
  CHECK (type NOT LIKE '%.corrected' OR subject_id IS NOT NULL),
  -- Validate at write time, never throw at read time
  -- (milestone-2.1-fixes.md item 2). Tier values (1, 2, 3) must match
  -- XP_TIER_VALUES in lib/calibration.ts. `payload ? 'tier'` guards against
  -- a missing key silently passing: `payload->>'tier' IN (...)` alone
  -- evaluates to NULL (not false) when the key is absent, and a CHECK
  -- constraint treats NULL as satisfied.
  CHECK (
    type NOT IN ('commitment.completed', 'commitment.completed.corrected', 'quest.step_completed')
    OR (payload ? 'tier' AND payload->>'tier' IN ('1', '2', '3'))
  ),
  -- milestone-3-spec.md §1: metric.recorded / note.recorded are domain-scoped.
  CHECK (
    type NOT IN ('metric.recorded', 'metric.recorded.corrected', 'note.recorded', 'note.recorded.corrected')
    OR domain IS NOT NULL
  ),
  -- payload: { metric, value, unit } (milestone-3-spec.md §1).
  CHECK (
    type NOT IN ('metric.recorded', 'metric.recorded.corrected')
    OR (payload ? 'metric' AND payload ? 'value' AND payload ? 'unit')
  ),
  CHECK (
    type NOT IN ('note.recorded', 'note.recorded.corrected')
    OR (payload ? 'note' AND payload->>'note' <> '')
  ),
  -- PRD §14: every Mark requires a note, not only retroactive ones.
  CHECK (
    type NOT IN ('mark.recorded', 'mark.recorded.corrected')
    OR (payload ? 'note' AND payload->>'note' <> '')
  ),
  -- Only kind 'outcome' exists until milestone 5 adds
  -- Commitment/Undertaking/Probe (milestone-3-spec.md §2 step 5).
  CHECK (
    type <> 'quest.created'
    OR (payload->>'kind' = 'outcome' AND payload ? 'statement' AND payload->>'statement' <> '')
  ),
  -- milestone-3-spec.md §6: starting rank capped at C, adjustable down from
  -- the proposal only, never up. array_position over RANKS' fixed order
  -- (lib/calibration.ts) mirrors that order on the SQL side.
  CHECK (
    type <> 'audit.completed'
    OR (
      payload->>'proposedRank' IN ('E', 'D', 'C', 'B', 'A', 'S')
      AND payload->>'startingRank' IN ('E', 'D', 'C', 'B', 'A', 'S')
      AND array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'proposedRank')
          <= array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], 'C')
      AND array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'startingRank')
          <= array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'proposedRank')
    )
  ),
  -- milestone-4-spec.md §3: resistance is optional (the tap writes the
  -- completion before resistance is chosen — a correction patches it in
  -- moments later), but its value is validated when given.
  CHECK (
    type NOT IN ('commitment.completed', 'commitment.completed.corrected')
    OR NOT (payload ? 'resistance')
    OR payload->>'resistance' IN ('easy', 'normal', 'against_resistance')
  ),
  -- commitment.missed (milestone-4-spec.md §6): written by the boundary
  -- job only, subject_id points at the commitments row.
  CHECK (type <> 'commitment.missed' OR subject_id IS NOT NULL)
);

-- "Written once" (milestone-3-spec.md §1): a unique index on a constant
-- expression, scoped by the partial WHERE, permits at most one row of this
-- type ever.
CREATE UNIQUE INDEX events_audit_completed_once ON events ((true)) WHERE type = 'audit.completed';

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

-- Row-level triggers do not fire for TRUNCATE; this closes that gap
-- separately, at statement level.
CREATE TRIGGER events_no_truncate
  BEFORE TRUNCATE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_events_mutation();

-- The Attention layer's log. Structurally separate from `events` — per
-- architecture-and-ux-v1.0.md §2.7, inclusion in a general aggregate must be
-- impossible, not merely avoided by convention. There is deliberately no
-- `domain` column: Attention behaviours are not domain-scored, so there is
-- nothing here for a domain-keyed aggregate to pick up even by accident.
-- Never joined into any view, rollup, or aggregate that feeds the Loop, the
-- nightly report, XP, momentum, or rank. Also holds `stance.changed`
-- (milestone-1.2-fixes.md item 2): stances exist only for behaviours the
-- user is trying to reduce, so a stance change is Attention-layer data,
-- not conduct.
CREATE TABLE attention_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL CHECK (type IN (
                    'attention.event_logged',
                    'attention.event_logged.corrected',
                    'stance.changed',
                    'stance.changed.corrected'
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

CREATE TRIGGER attention_events_no_truncate
  BEFORE TRUNCATE ON attention_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_events_mutation();

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
-- momentum — it exists only for the day-60 usage report (PRD §22).
CREATE TABLE daily_rollup (
  logical_day           date PRIMARY KEY,
  event_count           integer NOT NULL,
  domain_counts         jsonb NOT NULL DEFAULT '{}'::jsonb,
  instrumentation_count integer NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now()
);

-- Direction tables (architecture-and-ux-v1.0.md §2.3): current state,
-- freely editable, no append-only triggers — history lives in `events` /
-- `attention_events` via the paired event each write also appends.

-- milestone-3-spec.md §4: one row per behaviour; `stance.changed` in
-- `attention_events` carries the history. `not_now` rows exist here like
-- any other row — the filter is enforced by lib/stances.ts's query
-- functions, not by keeping such rows out of the table (AGENTS.md hard
-- rule 10).
CREATE TABLE stances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  behaviour  text NOT NULL UNIQUE,
  stance     text NOT NULL CHECK (stance IN ('observing', 'reducing', 'abstaining', 'not_now')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- milestone-3-spec.md §2 step 5: only kind 'outcome' (the three 2027
-- statements) exists in milestone 3. Commitment/Undertaking/Probe columns
-- arrive with milestone 5 as new ALTERs, not speculatively now.
CREATE TABLE quests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind = 'outcome'),
  statement  text NOT NULL CHECK (statement <> ''),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- milestone-3-spec.md §2 step 6: Season 01's opening only. The fuller
-- open-declaration fields PRD §15 describes belong to milestone 7's actual
-- open/close wizard — see db/migrations/0006_baseline_audit.sql's comment.
CREATE TABLE seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number     integer NOT NULL UNIQUE CHECK (number > 0),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at  timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- At most one open season at a time.
CREATE UNIQUE INDEX seasons_one_open ON seasons ((true)) WHERE status = 'open';

-- milestone-4-spec.md §0.1/§3: moved up from milestone 5 — the Loop can't
-- display or complete anything without commitments. week_start is always a
-- Monday (lib/day-math.ts's startOfWeek); a new week means a new row, not a
-- recurrence rule.
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
  CHECK (active_until IS NULL OR active_until >= active_from),
  -- Found via browser testing: a double form submission produced two
  -- identical rows. Every event write already tolerates a double tap via
  -- idempotency_key (architecture-and-ux-v1.0.md §2.6); this is the
  -- equivalent guard for the direction-table row a declaration inserts.
  UNIQUE (week_start, domain, label)
);

CREATE INDEX commitments_week_start_idx ON commitments (week_start);

-- Weekly lock, enforced at the data layer (PRD §13, AGENTS.md hard rule 9):
-- only the four declaration fields, only for the week currently in
-- progress. date_trunc('week', CURRENT_DATE) uses the database session's
-- timezone, not ARC_TIMEZONE — an approximation acceptable for a
-- defense-in-depth backstop; lib/commitments.ts's write path is the
-- timezone-and-logical-day-aware guard normal operation goes through.
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

-- Migration bookkeeping. Created directly by scripts/migrate.ts, not by a
-- numbered migration file (it has to exist before any migration can be
-- tracked).
CREATE TABLE schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
