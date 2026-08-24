# Design revision v2 — everywhere else

*Follows `design-revision-v1.md`. v1 framed the three Loop states. This extends the language to the rest of the product, adds interaction states, and settles ambient motion.*

*Includes one functional fix (§7) that isn't design at all but was found alongside these.*

---

## 0. What v1 got wrong

v1 said one screen gets full visual investment and everything else stays functional. That was the right instinct applied too literally. `Panel` is a shared component — putting every screen inside one costs almost nothing and removes most of the blandness.

**Revised rule: the frame is universal, the content is not.** Every screen sits in a panel with corner marks. Only the Loop states get compositional attention — centring, scale, generous space. Forms stay forms; they just stop floating on a bare background.

## 1. Panels everywhere

Apply `Panel` to: commitments, character sheet, marks, metrics, stances, audit steps, login.

Each gets a header label in the established style — `COMMITMENTS — WEEK OF 2026-08-24`, `CHARACTER SHEET`, `STANCES`. No other change to their content or layout beyond §2.

## 2. Grid, not list

Lists of like items become framed cells in a grid rather than rows separated by hairlines.

- 2 columns ≥768px, 1 column below
- Each cell: 1px `--border`, `--panel` fill, corner marks at 25% opacity (quieter than the parent panel's 40% — nested chrome must recede or the screen turns to noise)
- Cell content unchanged: label in sans, metadata in mono at `--ink-faint`

Applies to: commitments, Marks, metrics, stances, Outcomes on the character sheet.

Does **not** apply to today's commitment rows on the Day screen. Those stay full-width rows — they're a checklist being worked through, not a collection being surveyed.

## 3. Interaction states

Nothing in the product currently has hover, focus or active states. This is why it feels dead on desktop regardless of any animation, and it matters more than everything else in this document.

Every interactive element gets all four:

| State | Treatment |
|---|---|
| Rest | as built |
| Hover | border → `--accent-dim`, text → `--ink`, 120ms ease |
| Focus-visible | 1px `--accent` outline, 2px offset. Never removed, never `outline: none` |
| Active | 60ms, border → `--accent`, no movement |
| Disabled | 40% opacity, `cursor: not-allowed` |

Audit every button, link, input, select and nav item. There should be no interactive element without them.

## 4. Ambient motion

Requested, and the fastest available route to making this feel cheap. Two constraints before anything is built:

**The premise cuts against it.** A product whose stated purpose is to point the user outward should not have anything perpetually competing for attention. Perpetual motion is what attention-farming products do, and it would contradict the message budget directly.

**Therefore: motion you notice only if you stop and look for it.**

Permitted, all of it together, nothing more:

- **Corner marks breathe.** Opacity `0.40 → 0.50 → 0.40` over 4s, ease-in-out, infinite. Only on the active panel.
- **Scan line.** A 1px `--accent` line at 8% opacity crossing the panel's top border, left to right, once every 20s, over 1.2s. Only on the Loop states.
- **Rank glyph.** On the morning screen only, the rank letter's opacity drifts `0.92 → 1.0` over 6s.

Prohibited: particles, sparks, fire, lightning, smoke, pulsing glows, animated gradients, rotating elements, anything on a loop shorter than 4s, anything that moves position, anything on a form screen.

`prefers-reduced-motion`: all ambient motion off.

If any of it reads as decoration rather than as the system idling, remove it. The test is whether you'd notice it stopping.

## 5. Cursor

A custom cursor is requested. Two problems with the version described: effect cursors — fire, trails, particles — lag a frame or two behind the real pointer, which reads as broken rather than atmospheric; and the primary device is a phone, where there is no cursor.

**Build a reticle instead.** A small crosshair in `--accent`: two 6px strokes with a 4px gap at centre, 1px weight. Desktop only, via CSS `cursor:` with an SVG. No JS, no lag, no trail.

Over interactive elements it may thicken to 1.5px. That's the whole interaction.

If a reticle doesn't land, keep the system cursor. It is better to have no custom cursor than a cheap one.

## 6. Transitions still missing

Only Today animates. Once §1 lands, the arrival from v1 §5 and the transitions from v1 §5b apply to every panel and every navigation.

## 7. Nothing can be voided or edited

*Functional, not visual. Highest priority item in this document.*

Every write in the product is immediate and final. Clicking Complete writes `commitment.completed` with no confirmation; recording a metric writes `metric.recorded` with no way to fix a typo. The correction event types exist in the schema but nothing in the UI can produce one. In practice this has already caused an accidental commitment declaration and several wrong metrics.

The fix is general, not per-screen.

### 7.1 Two categories, two rules

**Conduct** — `commitment.completed`, `quest.step_completed`. These are claims about what you did.

- Can be **voided** for the rest of that logical day only
- After the day closes, they stand. Retroactively rewriting last week's conduct is precisely what the append-only design exists to prevent.

**Records** — `metric.recorded`, `note.recorded`, `mark.recorded`, `life.entry_logged`. These are measurements and descriptions.

- Can be **corrected or voided at any time**
- A mistyped weight has no integrity value. Preserving a typo as though it were true makes the record worse, not more honest.

### 7.2 Mechanism

- **Void:** a `*.corrected` event carrying `payload.voided = true`
- **Edit:** a `*.corrected` event carrying the new payload — already supported by `appendCorrection`
- A voided event contributes nothing anywhere `resolveEffectiveEvents` is consumed: XP, momentum, dormancy, rollups, the report, counts on the character sheet
- **The original is never removed.** The record shows the event happened and was withdrawn. That is the honest version, and it's the whole point of corrections existing.

### 7.3 UI

- Completed rows on the Day screen get an **Undo**, visible only while the logical day is open
- Every listed record — metrics, Marks, notes — gets **Edit** and **Remove** on its grid cell
- Removal is a void, never a delete. Nothing in this product deletes anything.
- Voided records are hidden from normal views. A "show withdrawn" toggle on the relevant screen is enough; they must remain reachable, since the log is the product.

### 7.4 Tests

- Complete, void, assert XP and momentum are identical to before the completion
- Record a metric, correct it, assert the latest value is read and the original is retained
- Void a metric, assert it disappears from the list and remains in `events`
- Attempt to void a completion from a previous logical day, assert refusal
- Rebuild-equivalence still passes with voided and corrected events present

## 8. Definition of done

- Every screen sits in a panel with corner marks
- Lists of like items render as grids; Day screen rows unchanged
- No interactive element lacks hover, focus-visible, active and disabled states
- Ambient motion is limited to the three effects in §4 and disabled under reduced motion
- Reticle cursor on desktop, or no custom cursor at all
- A completion can be voided the same day and leaves XP and momentum untouched
- Metrics, Marks and notes can be edited or removed at any time, and removal is always a void
- Nothing anywhere in the product issues a DELETE
- No copy changed
