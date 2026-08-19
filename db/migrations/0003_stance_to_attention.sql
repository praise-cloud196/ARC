-- Milestone 1.2 item 2: stance.changed is Attention-layer data (stances
-- exist only for behaviours the user is trying to reduce, philosophy §10),
-- not conduct. It moves from `events` to `attention_events` so it can no
-- longer register as general activity or sit in the table every Loop-facing
-- aggregate reads from — the same leak milestone-1.1-fixes.md item 1 closed
-- for attention.event_logged.
-- docs/milestone-1.2-fixes.md item 2.

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

ALTER TABLE attention_events DROP CONSTRAINT attention_events_type_check;
ALTER TABLE attention_events ADD CONSTRAINT attention_events_type_check CHECK (type IN (
  'attention.event_logged',
  'attention.event_logged.corrected',
  'stance.changed',
  'stance.changed.corrected'
));
