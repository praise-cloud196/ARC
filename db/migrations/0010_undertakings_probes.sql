-- Milestone 5: Undertakings and Probes. docs/milestone-5-spec.md.
--
-- Widen quests.kind (was 'outcome' only, per 0006_baseline_audit.sql's own
-- comment: "Loosen this CHECK in the migration that adds them, the same
-- way milestone 2.1 loosened the tier CHECK"). Default constraint names
-- for inline column CHECKs follow Postgres's <table>_<column>_check
-- convention, which is what 0006 created them as.
ALTER TABLE quests DROP CONSTRAINT quests_kind_check;
ALTER TABLE quests ADD CONSTRAINT quests_kind_check CHECK (kind IN ('outcome', 'undertaking', 'probe'));

-- status is now kind-conditional: an Undertaking is never 'achieved', a
-- Probe is never 'completed' — 'folded' is its own terminal state (§4:
-- fold is a successful close, not a failure, so it isn't spelled
-- 'abandoned' either).
ALTER TABLE quests DROP CONSTRAINT quests_status_check;
ALTER TABLE quests ADD CONSTRAINT quests_status_check CHECK (
  (kind = 'outcome' AND status IN ('active', 'achieved', 'abandoned'))
  OR (kind = 'undertaking' AND status IN ('active', 'completed', 'abandoned'))
  OR (kind = 'probe' AND status IN ('active', 'folded', 'abandoned'))
);

-- decision_date/signal exist only for Probes, and are both required
-- (never optional, PRD §13) when they do. No domain column: milestone-5-spec.md
-- §0 fixes Undertaking/Probe domain at 'career' on the events themselves,
-- so a column here would just be a constant repeated on every row.
ALTER TABLE quests ADD COLUMN decision_date date;
ALTER TABLE quests ADD COLUMN signal text;
ALTER TABLE quests ADD CONSTRAINT quests_probe_fields CHECK (
  (kind = 'probe' AND decision_date IS NOT NULL AND signal IS NOT NULL AND signal <> '')
  OR (kind <> 'probe' AND decision_date IS NULL AND signal IS NULL)
);

-- Max active per kind (milestone-5-spec.md §1: 3 Undertakings, 2 Probes —
-- PRD §13). These two numbers must match lib/calibration.ts's
-- QUEST_MAX_ACTIVE_UNDERTAKINGS / QUEST_MAX_ACTIVE_PROBES; a trigger can't
-- import TypeScript, same limitation 0005_valid_xp_tier.sql already
-- documents. Only checked on INSERT — a kind/status never changes after
-- creation except via UPDATE elsewhere in this file's application code,
-- which moves status away from 'active', never toward it, so re-checking
-- on UPDATE isn't needed.
CREATE OR REPLACE FUNCTION forbid_excess_active_quests() RETURNS trigger AS $$
DECLARE
  active_count integer;
  max_active integer;
BEGIN
  IF NEW.kind = 'undertaking' THEN
    max_active := 3;
  ELSIF NEW.kind = 'probe' THEN
    max_active := 2;
  ELSE
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_count FROM quests WHERE kind = NEW.kind AND status = 'active';
  IF active_count >= max_active THEN
    RAISE EXCEPTION 'at most % active % quests are allowed', max_active, NEW.kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quests_max_active
  BEFORE INSERT ON quests
  FOR EACH ROW EXECUTE FUNCTION forbid_excess_active_quests();

-- Widen quest.created's payload CHECK (0006) to accept undertaking/probe
-- shapes alongside outcome's.
ALTER TABLE events DROP CONSTRAINT events_valid_quest_created;
ALTER TABLE events ADD CONSTRAINT events_valid_quest_created CHECK (
  type <> 'quest.created'
  OR (payload ? 'statement' AND payload->>'statement' <> '' AND (
    (payload->>'kind' = 'outcome')
    OR (payload->>'kind' = 'undertaking')
    OR (payload->>'kind' = 'probe' AND payload ? 'decisionDate' AND payload ? 'signal' AND payload->>'signal' <> '')
  ))
);

-- quest.step_completed / quest.abandoned / probe.resolved / outcome.achieved
-- all act on an existing quests row and must reference it (same idiom as
-- events_missed_has_subject, 0007_commitments.sql).
ALTER TABLE events ADD CONSTRAINT events_quest_actions_have_subject CHECK (
  type NOT IN ('quest.step_completed', 'quest.abandoned', 'probe.resolved', 'outcome.achieved')
  OR subject_id IS NOT NULL
);

-- probe.resolved's action vocabulary, and fold's required note (PRD §13:
-- "required note on what was learned"). Same `payload ? 'x'` idiom as
-- 0005/0006 for why key-exists, not just ->>'x' IS NOT NULL.
ALTER TABLE events ADD CONSTRAINT events_valid_probe_resolution CHECK (
  type <> 'probe.resolved'
  OR (
    payload ? 'action' AND payload->>'action' IN ('double_down', 'fold', 'extend')
    AND (payload->>'action' <> 'fold' OR (payload ? 'note' AND payload->>'note' <> ''))
  )
);

-- quest.step_completed is conduct (design-revision-v2.md §7.1, same
-- category as commitment.completed) — voidable same logical day only.
-- 0009_void_completion.sql's own comment flagged this as the gap to close
-- "when [milestone 5] gives it a correction path." This is that migration.
ALTER TABLE events DROP CONSTRAINT events_valid_voided;
ALTER TABLE events ADD CONSTRAINT events_valid_voided CHECK (
  type NOT IN (
    'commitment.completed', 'commitment.completed.corrected',
    'quest.step_completed', 'quest.step_completed.corrected',
    'metric.recorded', 'metric.recorded.corrected',
    'note.recorded', 'note.recorded.corrected',
    'mark.recorded', 'mark.recorded.corrected',
    'life.entry_logged', 'life.entry_logged.corrected'
  )
  OR NOT (payload ? 'voided')
  OR payload->>'voided' = 'true'
);

-- Widen the event type list itself (0006's events_type_check) to add
-- quest.step_completed.corrected — the only genuinely new type name this
-- migration introduces; every other type this milestone writes to
-- (quest.step_completed, quest.abandoned, probe.resolved, outcome.achieved)
-- was already reserved in 0006.
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
  'quest.step_completed.corrected',
  'quest.abandoned',
  'probe.resolved',
  'outcome.achieved',
  'season.opened',
  'season.closed',
  'recovery.started',
  'return.detected'
));

-- events_valid_xp_tier (0005) already lists quest.step_completed by name —
-- nothing to change there.
