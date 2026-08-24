# Design revision v1 — the System as an object

*Narrow scope. Applies to the three Loop states and system messages only. Everything else stays deliberately plain.*

---

## 1. The diagnosis

The current build renders **documents**: text on a background, scrolling in a browser. The thing it's trying to be is an **object that appears over reality** — a framed panel with an edge, a header, and a moment of arrival.

That difference is structural, not decorative. Nothing about the copy, the colour, or the typography is the problem. The problem is that content sits directly on the page with no frame around it and no sense of having been delivered.

Fixing that is most of the work. Colour is a distant second.

## 2. Tokens

Replace the current palette. Values are starting points; adjust on screen, keep the relationships.

```
--ground        #0A0C10   near-black, slight cool cast
--panel         #0E1117   panel fill, barely lifted from ground
--border        #1C2230   1px panel edge
--ink           #E6E9EF   primary text
--ink-faint     #7A828F   secondary text, labels
--accent        #6C9DC6   muted steel blue — rank, system voice, corner marks
--accent-bright #8FD3E8   rare moments only: Marks, hidden quests, promotions
```

**The accent moves from gold to cool.** Build both and look at them on the morning screen before committing — but the cool reads as *system*, and gold reads as *achievement badge*, which is the wrong register for a product whose voice is deliberately flat.

Saturation stays modest. The goal is a panel that looks projected, not neon.

## 3. Type

- **System voice:** a technical monospace — JetBrains Mono or IBM Plex Mono. Uppercase, letter-spacing 0.18–0.25em. Used for rank, momentum, report lines, headers, all bracketed announcements.
- **User content:** a humanist sans — Inter. Normal case, normal spacing. Used for anything the user wrote: notes, Marks, Outcomes, commitment labels.

The contrast between the two must be obvious at a glance. It's how the interface distinguishes *the system speaking* from *you speaking*, and it does more work than any single visual choice here.

Scale on the morning screen: rank at 28–32px, body lines at 14–15px, header label at 10–11px.

## 4. The panel

The core change. Every Loop state and every system message is rendered inside one.

```
┌ ─────────────────────────────── ┐   ← header: 28px, hairline bottom border
│  DAY 3 · SEASON 01              │      label 10px mono, --ink-faint
├─────────────────────────────────┤
│                                 │
│  content, 24px inset            │
│                                 │
└ ─────────────────────────────── ┘
```

- 1px `--border` edge, no rounded corners beyond 2px
- `--panel` fill, one step above `--ground`
- **Corner marks:** 12px L-shaped brackets at all four corners, `--accent` at 40% opacity, sitting just outside the border. This single detail carries most of the "system window" feeling. It is also the detail most likely to be overdone — 1px strokes, nothing thicker.
- Max width 480px, horizontally centred, vertically centred on the morning and night screens
- No drop shadow. A panel is projected, not raised.

## 5. Arrival

System panels appear. They do not simply exist.

- opacity `0 → 1` over 240ms, ease-out
- translateY `6px → 0` over the same duration
- a 1px `--accent` line sweeps the header left to right, once, over 320ms, then fades
- no scale beyond `0.99 → 1`, no bounce, no overshoot
- fires **once** on mount, never on re-render
- `prefers-reduced-motion`: opacity only, 120ms

Nothing else in the product animates.

## 5b. Screen transitions

The arrival rule implies its opposite: if a panel *arrives*, it should also *leave*. A cross-fade between two screens would contradict the whole premise, because it implies the panel was a layer of the page rather than an object delivered to it.

So: **dismiss, empty ground, arrive.**

- Outgoing panel: opacity `1 → 0`, translateY `0 → 4px`, over 120ms ease-in
- **60ms of empty `--ground`.** Nothing on screen. This beat is the effect — it's what makes the next panel feel delivered rather than swapped.
- Incoming panel: the standard arrival from §5
- Total roughly 380ms

**Blackout, never whiteout.** White is off-palette entirely and a flash of it at 6am or 2am is genuinely unpleasant. The empty state between panels is `--ground` — the product going briefly dark is consistent with everything else about it.

Applies to navigation between screens only. **Not** to form submissions, not to completing a commitment, not to anything within a screen — those should feel instant. A transition on every interaction makes the product feel slow, and the Loop has a three-minute budget to protect.

`prefers-reduced-motion`: no transition, instant swap.

## 6. Bracketed announcements

System events are announced in the panel header:

```
[ SYSTEM REPORT ]
[ MARK RECORDED ]
[ QUEST COMPLETE ]
[ HIDDEN QUEST ]
```

11px mono, letter-spacing 0.25em, `--accent`, centred. `--accent-bright` only for Marks, hidden quests and rank promotions — the rare ones. If it fires weekly, it uses `--accent`.

## 7. Screen application

**Morning.** One panel, vertically centred, nothing else on screen. Header `DAY n · SEASON n`. Body: rank (large, mono, accent), momentum state, main quest, today's commitments. This screen gets the most attention of anything in the product.

**Day.** Commitment rows inside a panel. Tapping completes and reveals the three resistance options inline. Still no other affordance.

**Night.** Same panel. Header `[ SYSTEM REPORT ]`. The report lines as already written, unchanged. Length still follows activity.

**Nav.** Reduce to three — Today, Character Sheet, Commitments. Marks, Metrics and Stances move to links on the character sheet. A two-row menu bar under a title card defeats the title card.

## 8. What stays plain

The audit wizard, commitments declaration, Marks, Metrics, Stances, and every form. Panel chrome appears on the three Loop states and system messages only. Spending design effort on a screen used four times a year is effort taken from the screen used every morning.

## 9. Prohibited

Reaffirming and extending the existing list: emoji, gradients, progress rings, confetti, badges, drop shadows, charts on the morning screen, exclamation marks, **red anywhere in the product**.

Additions specific to this revision: glow blur beyond 8px, neon saturation, particle effects, sound, scanline or CRT overlays, any typeface associated with a specific anime, and any purple-and-black palette. The reference is a system interface, not a costume.

## 10. The line that must hold

**Theatrical frame, sober voice.**

The panel may be dramatic. The copy may not. The System never congratulates, never encourages, never exclaims. *Day incomplete. Progress continues.* The moment a panel starts praising the user, this becomes a children's game — and the frame is precisely what makes that temptation stronger.

## 11. Definition of done

- Morning, Day and Night render inside panels with corner marks
- The arrival animation fires once on mount and respects reduced motion
- System voice and user content are visually distinguishable at a glance
- Both accent options have been viewed on the morning screen and one chosen deliberately
- Nav is back to three items
- No form screen has gained any styling
- No copy has changed
