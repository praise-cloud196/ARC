-- A short, optional title for a quest (used for Goals / Outcomes): shown on
-- the Morning screen in place of a paragraph-length statement. `quests` is a
-- direction table (current state, freely editable), so this is a plain
-- column, not an event.
ALTER TABLE quests ADD COLUMN title text CHECK (title IS NULL OR title <> '');
