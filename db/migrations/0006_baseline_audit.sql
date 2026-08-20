-- Milestone 3: baseline audit. docs/milestone-3-spec.md §1-6.
--
-- New event types (§1): metric.recorded and note.recorded are zero-XP,
-- domain-scoped peers (PRD §9 — a qualitative note is first-class, not a
-- comment attached to a number); audit.completed marks onboarding's end,
-- written once, with no `.corrected` variant — like the other one-time
-- boundary events (season.opened, recovery.started, ...), there's nothing
-- about "onboarding completed" that becomes a different fact later.
ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (type IN (
  'commitment.completed',
  'commitment.completed.corrected',
  'commitment.missed',
  'condition.logged',
  'condition.logged.corrected',
  'mark.recorded',
  'mark.recorded.corrected',
  'life.entry_logged',
  'life.entry_logged.corrected',
  'metric.recorded',
  'metric.recorded.corrected',
  'note.recorded',
  'note.recorded.corrected',
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
));

-- Validate at write time, never throw at read time (AGENTS.md hard rule 13,
-- milestone-2.1-fixes.md item 2). metric.recorded / note.recorded are
-- domain-scoped by spec — a row of either type without a domain is
-- malformed and permanently unfixable once inserted.
ALTER TABLE events ADD CONSTRAINT events_metric_note_have_domain CHECK (
  type NOT IN ('metric.recorded', 'metric.recorded.corrected', 'note.recorded', 'note.recorded.corrected')
  OR domain IS NOT NULL
);

-- `payload: { metric, value, unit }` (milestone-3-spec.md §1). `payload ?
-- 'x'` (key-exists), not `payload->>'x' IS NOT NULL` — see
-- db/migrations/0005_valid_xp_tier.sql's comment on why the latter alone
-- lets a missing key through.
ALTER TABLE events ADD CONSTRAINT events_valid_metric CHECK (
  type NOT IN ('metric.recorded', 'metric.recorded.corrected')
  OR (payload ? 'metric' AND payload ? 'value' AND payload ? 'unit')
);

ALTER TABLE events ADD CONSTRAINT events_valid_note CHECK (
  type NOT IN ('note.recorded', 'note.recorded.corrected')
  OR (payload ? 'note' AND payload->>'note' <> '')
);

-- PRD §14: "a note is required" for every Mark, not only retroactive ones —
-- true since milestone 1 but never enforced at the data layer until now.
-- Retroactive Marks additionally carry `payload.retroactive = true`
-- (milestone-3-spec.md §3), but that flag isn't validated here: a
-- non-retroactive Mark is equally required to have a note, so the
-- constraint doesn't need to distinguish the two.
ALTER TABLE events ADD CONSTRAINT events_mark_has_note CHECK (
  type NOT IN ('mark.recorded', 'mark.recorded.corrected')
  OR (payload ? 'note' AND payload->>'note' <> '')
);

-- Only `kind = 'outcome'` exists yet (milestone-3-spec.md §2 step 5) —
-- Commitment/Undertaking/Probe are milestone 5. Loosen this CHECK in the
-- migration that adds them, the same way milestone 2.1 loosened the tier
-- CHECK rather than widening it speculatively now.
ALTER TABLE events ADD CONSTRAINT events_valid_quest_created CHECK (
  type <> 'quest.created'
  OR (payload->>'kind' = 'outcome' AND payload ? 'statement' AND payload->>'statement' <> '')
);

-- milestone-3-spec.md §6: starting rank is capped at C and can only be
-- adjusted down from the system's proposal, never up. Encoding "down" and
-- "capped at C" as an index comparison against RANKS' fixed order
-- (lib/calibration.ts) rather than duplicating that order as a second
-- literal list here would be nicer, but a CHECK constraint can't import a
-- TS module — array_position over the same six letters is the SQL-side
-- mirror of it. If RANKS ever changes, this has to change with it.
ALTER TABLE events ADD CONSTRAINT events_valid_audit_completed CHECK (
  type <> 'audit.completed'
  OR (
    payload->>'proposedRank' IN ('E', 'D', 'C', 'B', 'A', 'S')
    AND payload->>'startingRank' IN ('E', 'D', 'C', 'B', 'A', 'S')
    AND array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'proposedRank')
        <= array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], 'C')
    AND array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'startingRank')
        <= array_position(ARRAY['E', 'D', 'C', 'B', 'A', 'S'], payload->>'proposedRank')
  )
);

-- "Written once" (milestone-3-spec.md §1): a unique index on a constant
-- expression, scoped by the partial WHERE, permits at most one row of this
-- type ever — the standard Postgres idiom for "at most one row matching a
-- predicate" when there's no natural unique column to index.
CREATE UNIQUE INDEX events_audit_completed_once ON events ((true)) WHERE type = 'audit.completed';

-- Direction tables (architecture-and-ux-v1.0.md §2.3): current state,
-- freely editable, no append-only triggers — history lives in `events` /
-- `attention_events` via the paired event each write below also appends.

-- milestone-3-spec.md §4: one row per behaviour; `stance.changed` in
-- `attention_events` carries the history. `not_now` rows exist here like
-- any other — the filter is enforced by lib/stances.ts's query functions,
-- not by keeping such rows out of the table (AGENTS.md hard rule 10).
CREATE TABLE stances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  behaviour  text NOT NULL UNIQUE,
  stance     text NOT NULL CHECK (stance IN ('observing', 'reducing', 'abstaining', 'not_now')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- milestone-3-spec.md §2 step 5: only the three 2027 statements (kind
-- 'outcome') exist in milestone 3. Commitment/Undertaking/Probe columns
-- (domain, tier, weekly target, decision date, signal, ...) arrive with
-- milestone 5 as new ALTERs, not speculatively now.
CREATE TABLE quests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind = 'outcome'),
  statement  text NOT NULL CHECK (statement <> ''),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- milestone-3-spec.md §2 step 6: Season 01's opening only. The fuller
-- open-declaration fields PRD §15 describes (what matters most, domains
-- receiving attention, main quests, deliberately-ignored) belong to
-- milestone 7's actual open/close wizard, which is what makes those
-- selections meaningful (e.g. "main quests" needs quests to choose from,
-- and quests beyond the three Outcomes don't exist until milestone 5).
CREATE TABLE seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number     integer NOT NULL UNIQUE CHECK (number > 0),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at  timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- At most one open season at a time — same constant-expression partial
-- unique index idiom as events_audit_completed_once above.
CREATE UNIQUE INDEX seasons_one_open ON seasons ((true)) WHERE status = 'open';
