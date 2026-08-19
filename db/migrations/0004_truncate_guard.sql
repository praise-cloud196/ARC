-- Milestone 1.2 follow-up. Row-level BEFORE DELETE triggers do not fire for
-- TRUNCATE — Postgres treats it as a separate, statement-level operation —
-- so `TRUNCATE events` (or `attention_events`) was a live, silent bypass of
-- the append-only invariant that AGENTS.md hard rule 1 and the existing
-- triggers did not actually close. A statement-level BEFORE TRUNCATE
-- trigger closes it the same way.

CREATE TRIGGER events_no_truncate
  BEFORE TRUNCATE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_events_mutation();

CREATE TRIGGER attention_events_no_truncate
  BEFORE TRUNCATE ON attention_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_events_mutation();
