# Philosophy & Mechanics — v0.2

*Supersedes v0.1. Working codename: **ARC** — deliberately disposable, chosen so it can't accidentally become the product name.*

*Everything here is written as a decision rather than an option, so that disagreeing with it is cheap and drifting past it is not.*

---

## 1. The premise

Most productivity tools measure output. This one measures **agency** — the developing capacity to deliberately choose what you do, and then to do it.

All four domains are the same goal in different material:

- **Career** — agency over your circumstances and income
- **Body** — agency over your physical capability
- **Attention** — agency over your impulses and focus
- **Life** — the reminder that agency is *for* something

The win condition is not a level. It is being able to say, in August 2027: *I trust myself more, because I have repeatedly demonstrated that I choose what I do.*

## 2. What the system actually is

It cannot gate anything. It cannot withhold real capability, prevent an action, or issue a reward that means anything on its own. Pretending otherwise is what makes gamified apps feel hollow within a month.

Its real powers are three:

1. **Memory** — it remembers your conduct more accurately and for longer than you do.
2. **Recognition** — it names patterns and achievements that would otherwise pass unmarked.
3. **Framing** — it decides what counts, and how a bad day is described.

Every mechanic here draws on one of those three. Any proposed feature that depends on gating or on self-issued rewards is structurally fake and should be rejected on sight.

## 3. Design laws

Non-negotiable. These exist to kill features quickly.

1. **History is permanent. Direction is flexible.** The record of what you did accumulates and is never edited. What you are currently pointed at can be changed at any boundary without invalidating any of it.
2. **Flexibility is granted at boundaries only.** Season starts, week starts, and returns from absence are where direction changes. *Within* a week, commitments are immutable. Without this, "flexible direction" quietly becomes "nothing was ever asked of me."
3. **Nothing built is ever taken away.** XP never decreases. Levels never decrease. Marks are permanent. Only momentum and condition move downward, because that is their function.
4. **Score inputs. Record outcomes.** You are scored only on what you control. Results you don't control are recorded and celebrated, never failed.
5. **The daily loop is capped at three minutes.** Anything that doesn't fit goes into the weekly ritual or doesn't exist.
6. **The system never initiates to create a return.** No engagement notifications. It speaks at fixed boundaries or when you arrive.
7. **No day counters for anything you're trying to reduce.** Density and trend only.
8. **Scoring is deterministic and inspectable.** No AI touches a number.
9. **One domain is deliberately unscored.** Visibly so.
10. **Evidence must never become bureaucracy.** The moment recording something costs more than doing it, the record stops being kept.

## 4. The character model

Three layers, moving at three different speeds. This is the spine.

**Identity** — who you have become. Domain levels, permanent Marks, tenure. Moves in months. Cannot decrease.

**Momentum** — how you are currently progressing. Rolling 14-day completion of your own declared commitments against the prior 14 days. Expressed as a state, not a percentage: *Building / Strong / Holding / Slipping / Dormant.* Moves in days.

**Condition** — today. Sleep, energy, one tap. Feeds the nightly report and long-run pattern detection. Never scored, never shown as good or bad.

A bad day moves Condition. A bad fortnight moves Momentum. Only sustained conduct moves Identity.

### Two ledgers

| | Activity ledger | Achievement ledger |
|---|---|---|
| Volume | High, daily | Perhaps 10–30 a year |
| Unit | XP | **Marks** |
| Requires | Self-attestation | A note, optionally an artifact |
| Drives | Domain levels, momentum | Rank, identity, history |
| Decays | No, but goes dormant | Never |

Training today is XP. Ten clean pull-ups is a Mark. Reading tonight is XP. Finishing the book is a Mark. Marks award no XP — they are a strictly higher currency, and mixing them would cheapen both.

## 5. Evidence

Two standards, matched to what's being recorded.

**Routine actions — self-attestation.** If you say you trained, read, or meditated, that's the record. No proof, no friction, no doubt. The system trusts you completely at this tier, and the three-minute budget depends on it.

**Marks — a note is required, an artifact is optional.**

The note answers one question, and it is not *did you do it*:

> **What changed because of this?**

This is the core of the evidence design. A screenshot proves an event occurred; a sentence about what changed is what makes the entry legible to you a year later, when you've forgotten the context entirely. It also keeps the focus on transformation rather than filing.

An artifact — URL, screenshot, document, published piece, portfolio entry — can be attached and should be for anything externally real. It's encouraged, never required.

Marks therefore have two states: **Completed** (note only) and **Documented** (note + artifact).

**"Verified" is deferred.** In a single-user product there is no verifier, so a third tier would be aspirational cruft. The schema should leave room for it; v1 should not implement it.

## 6. Progression mechanics

**XP is derived, never priced.** You never type a number. Each quest carries a tier, and the tier carries the value:

- Tier 1 — routine, up to ~30 minutes — **10 XP**
- Tier 2 — substantial, ~30–90 minutes — **25 XP**
- Tier 3 — demanding, 90+ minutes or genuinely hard — **50 XP**

You can game this by lying about what you did. You cannot game it by being generous with yourself, which is the failure mode that kills self-scored systems.

**Resistance tag.** On completion, one tap: *easy / normal / against resistance*. It does not affect XP — resistance multipliers invite you to dramatize your own difficulty. It's recorded because a year from now, the graph showing that the hard ones became frequent and then stopped feeling hard is the best evidence of agency the system can produce.

**Levels are per-domain. There is no global level.** Cost to reach level *n* rises linearly (roughly 100 + 50(n−1)), calibrated at Season 0 so a strong year produces roughly level 10–12 in an actively pursued domain.

**Dormancy, not decay.** After 21 days without activity a domain enters a *dormant* visual state. Nothing is lost. It is a fact displayed, not a punishment applied.

**Rank is global, rare, and evidence-gated.** E → D → C → B → A → S. Evaluated **only at season close** and requires: new Marks in at least two domains, minimum tenure at current rank, and no more than one dormant domain. Two to three promotions a year at most. A rank that moves monthly is a level wearing a letter.

## 7. Seasons

A season is a chapter, not a sentence. **6–12 weeks, ended deliberately rather than expiring.** The system prompts for close at week 8 and again at week 12; you decide. Within a season the XP formula, tiers and domain structure are frozen — the physics change at boundaries, informed by evidence, not by how you feel on a Tuesday.

**Season open** — what matters most; which domains get attention; the season's main quests; what behaviours you're developing; **and explicitly, what you are deliberately ignoring for now.** That last one is a first-class field, not an omission.

**Season close** — what changed; what you learned; what continues; what is abandoned; what the next season is. Rank is evaluated here. The season is written up and becomes a permanent chapter in your history.

**A bad season cannot damage the character.** It produces a chapter and a set of conclusions. That is all a season is for.

## 8. Quest model

Four objects. "Tasks" do not exist in this product — anything smaller than a commitment belongs in whatever tool you already use.

**Commitment** — a recurring input declared for the week. *Train 4×. Five deep work sessions. Two evenings without the phone.* Scored. The primary source of XP and the only input to momentum.

**Undertaking** — a multi-week project you control, with ordered steps. Scored on steps.

**Probe** — a time-boxed bet with a declared decision date and a declared signal. *Ship an AI tool for marketers. 8 weeks. Signal: does anyone pay, or ask for it unprompted?* Scored on the work, never the result. At the decision date you write what you learned and choose: double down, fold, or extend once. **Folding is a successful outcome, not a failure** — this is the object that resolves career positioning by evidence rather than by another round of reasoning about yourself.

**Outcome** — a result you want but do not control. *10 pull-ups. A remote role. Canada.* Not scheduled, not scored, never failed. When one lands it becomes a Mark and a major event in your history. Until then it sits on the character sheet as something you are pointed at.

## 9. Domain behaviour

The four domains do not behave identically, and forcing symmetry would break the product.

**Career / Capability** — runs on Probes and Undertakings. Positioning is an open question to be resolved by evidence across the year, not a goal declared now. Migration is an Outcome with preparatory Commitments beneath it; it can never be failed.

**Body** — the only clean input→output ladder, and the domain that carries the first six weeks while the others are thin. **Manual entry only in v1** — no Apple Health, no wearables, no sync. The three-minute budget matters more than perfect data, and integrations would turn this into a health dashboard.

Metrics are user-defined and few: weight, pull-ups, push-ups, sessions, distance, sleep. Critically, **an unquantified note is a first-class entry**. *"I feel stronger"* sits alongside *8 → 10 pull-ups* in the same log. The numbers are evidence, not the experience.

**Attention / Inner life** — the private layer. See §10.

**Life / Relationships** — **unscored, permanently and visibly.** No XP, no level, no completion. Two behaviours only: it *remembers* (experiences, people, things that weren't productive) and it *notices absence* (nine weeks since you last saw someone who matters). The refusal to score this is stated in the interface, not merely implemented. It is the product asserting that agency is for living, not the reverse.

## 10. Stances, setbacks and relapse

**Every behaviour you want to reduce carries a declared stance**, not a target:

- **Observing** — logged, no goal, just data
- **Reducing** — actively working the trend down
- **Abstaining** — currently walking away entirely
- **Not now** — not tracked, not counted, not mentioned by the system

*Not now* is a first-class feature. Being able to honestly say "I'm not ready for this one" without being nagged is the difference between a record you trust and one you start hiding things from. Stances are reviewed only at season boundaries.

**No day counters. Ever.** A "14 days clean" number turns day 15 into a catastrophe, and the catastrophe produces the multi-week collapse — not the lapse. Rolling 28-day density instead: *9 in the last 28 days, down from 15.* One lapse moves the number slightly. The trend survives.

**Logging is neutral and asks for conditions, not confession.** Time, state, what preceded it. Two taps and out. No reflection prompt in the moment — that's where shame lives. Reflection happens at the weekly ritual, if at all.

**The payoff is memory, not willpower.** After roughly eight weeks the system can tell you something true you couldn't see: that it clusters on low-sleep days, or after particular kinds of evenings. No amount of discipline produces that.

**Placement.** Never on the morning dashboard. Never affects XP. Never in the nightly report unless you go looking. Nothing here should make opening the app feel bad.

**Boundary, stated once.** If frequency or distress climbs consistently over a long window, the system says plainly that this looks like something worth getting real help with — then drops it. Once. Never a nag, never a diagnosis, never a pretence that XP is a treatment.

## 11. The return protocol

**The re-entry experience matters more than the streak experience**, because the person using this is not perfectly disciplined and life will interrupt. This is the most important copy in the product.

On return after 14+ days:

- **The character is intact.** Nothing was lost, nothing expired, no counter reset.
- **The open season auto-closes** and is written up as a chapter — you cannot fail a season by leaving it. You come back and *read* what it was.
- **You are shown**: what you had been working toward, what you accomplished before the gap, how long it's been, and which commitments may no longer be relevant.
- **Direction is fully re-openable.** Quests can be abandoned without penalty. Abandonment is recorded as a decision, not a failure.

Register:

> The System has been waiting.
> Your previous progress remains.
> You left during Season 03 with 3 active Main Quests.
> 67 days have passed.
> Some things may have changed.

**Recovery Phase** — offered on return, never mandatory: a reduced set of one or two commitments to rebuild momentum. **Bounded at two weeks, available only after a genuine gap, not selectable at will.** Without those bounds it becomes a permanent low-effort mode.

## 12. The System's voice

Flat, terse, factual. It states what happened. It does not console, exhort, over-congratulate, or tell you what you're feeling. No exclamation marks. No "you've got this."

The register is set by your own line:

> **Day incomplete. Progress continues.**

**Message budget:** the nightly report, plus at most **one** other system message per day, plus the weekly ritual. A recognition that fires daily is wallpaper within a fortnight.

## 13. Hidden quests — rules, not AI

Rule-based thresholds over your own data. The magic is that *you didn't declare it*, not that a model inferred it. A hallucinated pattern would destroy the effect permanently, so nothing here is generated.

Seed rules (max one surfaced per week):

1. **Undeclared consistency** — 12+ occurrences in 28 days of something never set as a goal
2. **Resistance pattern** — 5 "against resistance" completions in 14 days
3. **Return** — activity after 7+ days dormant. Recognized, never scolded. Returning is rewarded more than an unbroken run is.
4. **Convergence** — all three scored domains active in the same week, three weeks running
5. **Mirror** — this month against the same month a year ago

## 14. The two speeds

**The Loop** — daily, ≤3 minutes, fixed forever.

- *Morning, 30–60s:* rank, momentum state, main quest, today's commitments
- *During the day:* one-tap completion + resistance tag
- *Night, 1–2 min:* the report — what moved, what didn't, momentum trend, one line of framing

**The Ritual** — weekly, 20–30 minutes, deliberately slow. Review, writing and reflection, probe decisions, next week's commitments, relationship absences.

Everything you're tempted to add to the daily view goes here. **This is the rule that protects the three minutes.**

## 15. Writing and references

The product is a coordination layer, not a content store. It does not become another Notion.

**In-app, lightweight only:** daily reflections, quest notes, Mark notes, setback reflections, season write-ups. Short fields, markdown, no editor to speak of.

**Long-form lives wherever you already write.** The app stores a **Reference** — a labelled link to a document, journal, or published piece — and records that the writing happened. A Mark reads *Reflection Practice — 30 days · [linked journal]*. The system records the development, not the content.

## 16. History — the actual product

The RPG layer is how the data gets collected. The history layer is what the data is *for*, and it's the only part that gets better the longer you use it.

**Onboarding is a baseline audit, not an empty character.** An honest 20–30 minute assessment producing a filled-in character sheet on day one: current state per domain, **retroactive Marks for things already achieved**, stances, body baseline, current financial position. You start as who you actually are — probably rank D or C — not at zero. Without this, month three has nothing to compare against and day one has no emotional payoff.

**Outputs:** the season chapter, the annual retrospective, and the mirror — *one year ago / today*, in specifics. This layer answers "why does this still matter in six months" and "what is it worth if I don't open it for a week."

## 17. Where AI is used

**Yes:** the weekly and seasonal narrative from structured data; decomposing a vague ambition into a probe or undertaking; conducting the post-setback reflection as an interview rather than a form; the annual retrospective.

**No:** anything touching a score. Any daily copy — it becomes slop by day ten. Any inference about how you feel. Any coaching chat.

## 18. Explicitly out of scope

Classes. Skill trees and unlocks. Boss battles as a distinct object (a boss is an Undertaking with a completion ceremony). Guild terminology. Streaks. A global level. Social features, leaderboards, sharing. Inventory, currency, marketplace. AI coaching. Health integrations. Any clinical or treatment framing.

## 19. Architectural consequence

*Not a technical design — one implication too structural to leave until later.*

"History is permanent, direction is flexible" is a statement about storage. It means an **append-only event log** of what happened, with current state (active quests, commitments, stances, domains) as a **mutable projection** on top of it. Editing direction never rewrites history; abandoning a quest appends an abandonment event rather than deleting the quest.

Getting this backwards — modelling current state as the source of truth and history as a derived log — is the one mistake that would be expensive to reverse and would quietly break the retrospective layer, which is the product.

## 20. Remaining open

1. **Season 0 calibration** — the XP curve, level costs, and rank tenure minimums need real numbers before the PRD's data model is fixed. These are guesses until you've run four weeks.
2. **The nightly report's exact contents** — the highest-frequency surface in the product and still under-specified.
3. **Name and in-world vocabulary** — deferred deliberately until the product's own terminology settles.
