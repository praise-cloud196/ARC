# Milestone 4 — The Loop, precise spec

*The milestone that makes the product livable. First UI work, and the point at which ARC becomes usable daily.*

*Supersedes the milestone ordering in `architecture-and-ux-v1.0.md` §5 — see §0.*

---

## 0. Two corrections to the plan

**0.1 Commitments move from milestone 5 into milestone 4.** The original order has the Loop at 4 and commitments at 5, but the Loop's entire purpose is displaying and completing commitments. It cannot be built without them. Milestone 4 therefore includes the `commitments` direction table, weekly declaration, and data-layer weekly lock. Undertakings, Probes and Outcomes remain in milestone 5.

**0.2 The audit UI belongs here.** Milestone 3 shipped backend-only, so the audit exists but cannot be run. Milestone 1–4 is meant to be "the smallest livable product," and it isn't livable without a way to onboard. Build the audit wizard as part of this milestone, before the Loop — it's the first screen that will ever be used, and it establishes the visual language.

## 1. Fix the scan problem first

`computeIdentity` now performs five full event-log replays to produce one result: `computeDomainLevel` once per scored domain, plus `resolveEffectiveEvents` again for tenure. The morning screen calls this. Milestone 2.1 item 3 flagged the pattern; it has since compounded, exactly as predicted, and every subsequent surface will inherit it.

Required, before any UI work:

- One resolution pass per request. `resolveEffectiveEvents` is called **once**, and every derived value — per-domain XP, per-domain level high-water marks, marks count, tenure, momentum inputs, dormancy — is computed from that single in-memory pass.
- Request-scoped memoisation is acceptable; a persistent cache is not, since it would become a second source of truth.
- Assert it: a test that counts queries issued while rendering the morning screen's data, and fails above a fixed threshold.

The three-minute Loop budget is a product requirement. A morning screen that takes two seconds to draw has already spent a meaningful fraction of it.

## 2. Design language

The aesthetic is a product requirement, not decoration (PRD §23, philosophy §19). Left unspecified, this will come out as a generic dashboard. It should feel calm, premium, serious, and slightly mysterious — never childish, never corporate, never a habit tracker.

**Concrete direction:**

- **Dark, near-black ground.** Not pure `#000`; something with a slight cool cast. Light text at reduced opacity rather than full white.
- **One accent colour, used sparingly.** Reserved for state changes and the system's own voice. If everything is accented, nothing is.
- **Type carries the identity.** A monospace or technical sans for system output — the nightly report, rank, momentum state — set in uppercase with wide letter-spacing. A normal humanist sans for user-entered content. The contrast between "the system speaking" and "you speaking" should be visible at a glance.
- **Generous vertical space.** The morning screen holds five or six lines of content on a phone. It should feel like a title card, not a list.
- **Motion is rare and slow.** A state change may fade. Nothing bounces, nothing pulses, nothing celebrates.

**Prohibited:** emoji, gradients, progress rings, confetti, badges with shine, drop shadows for depth, charts on the morning screen, exclamation marks, any colour used to indicate failure. Red does not appear in this product.

**The morning screen gets full visual investment. Every other screen is functional.** Do not spend equally.

## 3. Commitments

`commitments` direction table: `id`, `domain`, `label`, `tier`, `weekly_target`, `week_start`, `active_from`, `active_until`.

**Weekly lock, enforced at the data layer** (PRD §13, AGENTS.md rule 9): a commitment whose `week_start` is the current week rejects UPDATE to `label`, `tier`, `weekly_target`, or `domain`. Enforce with a trigger, not application logic — the UI must not be the thing standing between the user and editing their own terms mid-week.

Completing a commitment appends `commitment.completed` with `payload.tier` and `payload.resistance`.

`commitment.missed` is written by the boundary job (§6), never by the user.

## 4. The audit wizard

Per `milestone-3-spec.md` §2. Linear, resumable, one route with a step parameter. Progress lives in the direction tables; closing the browser at step 4 loses nothing.

Terminates on the character sheet, fully populated. **No screen in the app may be empty after this completes.**

The rank proposal is shown with its explanation and a control to adjust down only.

## 5. Today — the three states

One route. State selected by clock time relative to the logical day boundary (06:00) and the user's display-hour preference.

**Morning.** Read-only. Rank · momentum state · season and day number · main quest · today's commitments. Nothing else. No charts, no XP totals, no history. The no-commitment variant is specified verbatim in PRD §12.1 — use that copy exactly.

**Day.** Commitment rows. One tap completes and immediately reveals the three resistance options inline; the completion is already written, resistance patches it via correction. Optional one-line note behind a secondary tap. **No other affordance may be added to this screen.**

**Night.** The report, per §6.

## 6. The nightly report

**Computed on demand from the log for the current logical day** — not generated at a scheduled hour (`milestone-1.1-fixes.md` item 4b). It becomes final when the boundary passes.

Maximum five lines. Deterministic. No AI.

**Report length follows activity.** A day with nothing logged produces a *shorter* report, not a longer one. This is the rule that prevents it becoming a lecture on precisely the days the user is least inclined to open it.

Use the five variants in PRD §12.3 verbatim — complete, partial, empty, Mark-containing, first-after-return. The closing framing line is drawn from a fixed set, selected deterministically by condition, may not repeat within seven days, and **is omitted when nothing true can be said.**

On a day containing a Mark, the Mark is the last line.

**Scheduled job:** the only one in the product. At the logical day boundary, write `commitment.missed` for every commitment whose target was not met, then rebuild the rollup. Nothing else runs on a timer, and nothing sends anything.

## 7. Constraints

- Mobile-first. This is used on waking, mid-day and at night — phone moments.
- Installable PWA.
- **Zero notifications.** No service worker push, no permission prompt, no scheduled sends.
- No AI, no model SDK.
- The Loop must be measurably under three minutes end to end.

## 8. Definition of done

- Audit runs start to finish in a browser and can be resumed after closing it
- Morning screen renders from a single event-log resolution pass, proven by a query-count test
- A commitment in the current week cannot be edited, proven against the database
- All five report variants render, verified against PRD §12.3 word for word
- Report on an empty day is shorter than on a full day
- No red, no emoji, no exclamation marks anywhere in the product
- Boundary job writes `commitment.missed` correctly across a simulated week
- A full day can be run on a phone in under three minutes
- Rebuild-equivalence still passes
