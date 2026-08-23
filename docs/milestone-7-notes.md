# Milestone 7 — running notes

Scope items accumulated ahead of milestone 7's own spec (the Ritual/Season
wizard: season close, reopen, the fuller open-declaration fields PRD §15
describes). Not a spec — just what needs to be remembered when that
milestone is actually planned.

## Season-boundary detection is currently a placeholder

`lib/stances.ts`'s `isWithinSeasonBoundary` gates stance changes to
existing behaviours (PRD §16), but the only boundary it can currently
detect is Season 01's opening — it's keyed to whether `audit.completed`
has been written yet, because that's the only season-boundary event that
exists so far (`lib/seasons.ts`'s `openSeason` covers opening; there is no
close/reopen).

Milestone 7 must replace `isWithinSeasonBoundary` with real season-boundary
detection once season close exists — checking against actual season
open/close events rather than a one-time audit-completion flag, so the
rule holds for Season 02 and beyond, not just Season 01.
