-- docs/milestone-6-spec.md §1-§2: Reference replaces the old bare
-- `artifact` string with a structured `{ label, url }` pair — a labelled
-- external link, not just a raw string of unknown shape. No new table
-- (§0's scope decision): this is a payload-shape constraint on the existing
-- mark.recorded / mark.recorded.corrected events, the same pattern
-- events_mark_has_note (0006) already uses for the note field.
--
-- Deliberately permissive about absence: a Mark with no `reference` key at
-- all is a valid Completed (undocumented) Mark. The constraint only fires
-- once a `reference` key exists, and then requires both `label` and `url`
-- to be present and non-empty — one without the other is exactly the
-- ambiguity this migration exists to close out.
ALTER TABLE events ADD CONSTRAINT events_valid_mark_reference CHECK (
  type NOT IN ('mark.recorded', 'mark.recorded.corrected')
  OR NOT (payload ? 'reference')
  OR (
    jsonb_typeof(payload->'reference') = 'object'
    AND payload->'reference' ? 'label'
    AND payload->'reference' ? 'url'
    AND payload->'reference'->>'label' <> ''
    AND payload->'reference'->>'url' <> ''
  )
);
