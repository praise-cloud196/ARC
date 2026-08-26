# Night-state commitment access — fix

*Small, self-contained. Found via real use: the Complete buttons vanish at the display hour even though the logical day, and therefore the ability to log conduct, stays open until the 6am boundary.*

---

## 1. Raise the default display hour

`ARC_DISPLAY_HOUR` defaults to 20 (8pm), which assumes a conventional evening. The user works overnight — 8pm is mid-session for them, not wind-down.

Set `ARC_DISPLAY_HOUR=23` in `.env.production` (and `.env.local` for consistency during dev). Not a code change — just get the value onto the deployed environment.

## 2. Give Night a way back to Day

Once `selectLoopState` returns `"night"`, there is currently no route back to the commitment rows for the rest of that logical day — even though the log itself doesn't close until the 6am boundary (`LOGICAL_DAY_BOUNDARY_HOUR`). "Presentation choice, not data cutoff" (the comment already in `logical-day.ts`) isn't true in practice: the cutoff exists in the UI even though it doesn't exist in the data.

Required:

- On the Night screen, below the report, add a small link — something like *"Log something from today"* — that reveals the same commitment rows the Day screen would show for the current logical day
- This is **not** a fourth loop state. It's the existing Day content, reachable from Night, still governed by the existing logical-day scoping (today's rows only, same idempotency, same weekly lock)
- Completing a commitment from this view does not change `selectLoopState`'s output — the screen stays on Night with the report visible above the reopened rows, it doesn't silently flip back to a Day-only view
- The report itself already recomputes on demand, so a completion logged this way is reflected correctly on the next real load

## 3. Definition of done

- `ARC_DISPLAY_HOUR=23` set on the production environment
- A commitment can be completed after the display hour and before the 6am boundary, from the Night screen
- The nightly report reflects a post-display-hour completion without requiring a page reload trick
- No change to Morning's behavior or to the boundary job
