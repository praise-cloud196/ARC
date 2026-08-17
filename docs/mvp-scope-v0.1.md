# ARC — MVP Scope v0.1

*Companion to Philosophy & Mechanics v0.2. Defines what v1 is, what it deliberately isn't, and how we'll know whether it worked.*

---

## 1. The question v1 exists to answer

> **On day 60, am I still using it — and does the record it produced feel true?**

Both halves matter. Usage alone would only prove the app is sticky, which is a failure mode you named yourself. "The record feels true" is the harder test: when you read back eight weeks of your own conduct, does it match what actually happened, and does it tell you something you didn't already know?

Everything in v1 is justified by that question. Everything that isn't, waits.

## 2. The governing principle: write everything, display little

The product's value compounds with time, which means **v1's job is mostly to start the clock.** Every event the retrospective layer will one day need must be captured correctly from day one, because data you didn't record is gone forever — but almost none of it needs to be *displayed* yet.

So: the write path is built fully and carefully. The read path is built minimally. The mirror ("one year ago / today") isn't in v1 because it *cannot* be — but v1 must record everything it will need when it arrives.

This is the single most important scoping decision, and it's also the cheapest, because writing correctly costs little and reading beautifully costs a lot.

## 3. What ships

### 3.1 The baseline audit (onboarding)

20–30 minutes, once. Produces a filled-in character sheet.

- Current state in each of the four domains, in your words
- **Retroactive Marks** — things you've already achieved, entered with notes. This is what prevents day one from being an empty vessel.
- Starting rank, derived from the audit (expect D or C)
- Stances for the Attention layer
- Body baseline: whatever metrics you choose, plus current numbers
- The three 2027 statements, recorded verbatim as the top-level Outcomes

This is the highest-leverage screen in v1. It creates day-one payoff *and* the anchor everything is later compared against.

### 3.2 Today (the Loop)

One surface, three states.

**Morning** — rank, momentum state, active season, main quest, today's commitments. Read-only. 30–60 seconds. This is the one screen that gets full visual investment.

**During the day** — one-tap completion, one-tap resistance (*easy / normal / against resistance*). Nothing else.

**Night** — the report. Rule-based, terse, five lines maximum: what moved, what didn't, momentum trend, domain XP, one line of framing.

### 3.3 The Ritual (weekly)

- Review the week: completions, misses, what the log actually says
- **You write the narrative.** In v1 this is a short structured prompt you fill in yourself, not generated text. This serves your wish to write more, and it means the system earns the right to narrate later by first watching how you do it.
- Set next week's commitments — which then lock
- Probe decisions if a decision date has landed
- Relationship absences surfaced from the Life log

### 3.4 The record

- **Activity log** — every completion, with tier, domain, resistance tag, timestamp
- **Marks** — note required, artifact optional, permanent
- **Domain levels and XP** — see §5
- **Character sheet** — identity, momentum, condition, rank, the four domains

### 3.5 Quests

All four objects, kept deliberately small in v1:

- **Commitments** — weekly, immutable once the week starts
- **Undertakings** — max 3 active, simple ordered steps
- **Probes** — **max 2 active**, with decision date and declared signal. Folding is recorded as a successful close.
- **Outcomes** — an unscored list you're pointed at, including the 2027 statements

### 3.6 The Attention layer

- Stances: *Observing / Reducing / Abstaining / Not now*
- Neutral event logging: time, state, what preceded it. Two taps.
- Rolling 28-day density displayed. **No counters, no streaks.**
- Lives behind its own entrance. Never on the morning screen, never in the nightly report.

Pattern reporting is not in v1 — it requires eight weeks of data to exist, so it ships when the data does.

### 3.7 The Life layer

The cheapest thing in the product and one of the most important. A log of experiences and people, plus an absence timer. **No score, no level, no completion.** The interface says so explicitly.

### 3.8 Seasons

Open (including *what I am deliberately ignoring*), close, write-up. Rank evaluated at close. The season becomes a permanent chapter.

### 3.9 Return protocol

Full implementation, not a v2 nicety. Detects a 14+ day gap, auto-closes the open season into a chapter, shows what you were working toward, re-opens direction without penalty, offers a bounded two-week Recovery Phase.

This is the least likely feature to be exercised in the first two weeks and one of the most likely to determine whether the product survives month four.

### 3.10 Hidden quests — two rules only

- **Return** — activity after 7+ days dormant
- **Undeclared consistency** — 12+ occurrences in 28 days of something never set as a goal

The other three are deferred: *Mirror* needs a year, *Convergence* and *Resistance pattern* need data volume neither of which v1 will have.

## 4. Non-negotiable constraints

1. **The daily loop stays under three minutes.** If a feature can't fit, it goes in the Ritual.
2. **Mobile-accessible.** The Loop happens on waking, during the day, and at night — those are phone moments. A desktop-only v1 would fail for reasons that have nothing to do with the product design.
3. **Zero notifications.** No exceptions in v1.
4. **Zero AI in v1.** See §6.
5. **Single user.** No auth complexity, no sharing, no accounts model beyond what's strictly required.

## 5. XP is built, but isolated

XP and domain levels ship in v1 because the morning screen would feel inert without them — but **nothing depends on them.** Momentum comes from commitment completion. Identity comes from Marks. Rank comes from Marks. History comes from the log.

That's deliberate: XP is the component most likely to feel fake by week six, and it should be possible to delete it entirely without touching anything else. **Isolate the decoration so it can be removed.**

If at day 60 the XP number is the part you look at, that's a warning sign, not a success.

## 6. Why no AI in v1

Every AI use we identified is genuinely valuable and every one of them is *better later*:

- The weekly narrative needs weeks of data to narrate. In v1 you write it, which is more useful anyway.
- The seasonal and annual retrospectives are physically impossible yet.
- Probe decomposition is a once-every-two-months action you can do by hand twice.
- The setback interview should be designed only after you've seen what your own setback logs actually look like.

Shipping without AI also forces the rule-based skeleton to be good on its own. If the product only works because a model is writing encouraging prose over it, we've built the wrong thing.

## 7. Not in v1

**Deferred by physics** — cannot exist yet, will ship when data allows: the mirror, the annual retrospective, Attention pattern reporting, three of five hidden quest rules, meaningful rank movement (one promotion at most in 60 days).

**Deferred by choice**: all AI, notifications, health integrations, body-metric charting beyond a simple list, multi-season comparison views, export, theming, anything social.

**Permanently out** (from Philosophy §18): classes, skill trees, boss battles as an object, streaks, a global level, inventory, currency, leaderboards, clinical framing.

## 8. What the first 60 days should feel like

**Day 1** — you finish the audit and see a filled character sheet with a rank, four domains, retroactive Marks, and three statements about 2027. Nothing is empty. This is the moment that decides whether you come back.

**Day 2–13** — the Loop. Three minutes a day. Probably feels thin, and that's expected; there's nothing to look back at yet. Body carries this period because its feedback is fastest and least ambiguous.

**Day 14** — first Ritual with real data. First time the log tells you something you'd misremembered.

**Day 21–30** — first hidden quest is plausible. First Marks that weren't retroactive.

**Day 56** — first season close. Written chapter, rank evaluation, next season opened. This is the first moment the product does the thing it exists to do.

**Day 60** — evaluation. See below.

## 9. How we'll evaluate it

**The app instruments itself.** It records every open, every session length, and every day with zero activity. At day 60 you get an honest usage report about your own behaviour, not an impression.

Criteria:

1. **Used on ≥40 of 60 days**, without deliberate effort to keep the number up
2. **The Loop actually stayed under three minutes** — measured, not assumed
3. **At least one moment** where the record told you something true you'd have otherwise forgotten or misremembered
4. **You gave it a real setback** — i.e. you logged a bad week honestly rather than avoiding the app. If you disappeared *because* things went badly, the product failed at its central promise.
5. **Reading the season chapter feels like a record of you**, not a spreadsheet

Failing 1 while passing 3 and 5 is an interesting result, not a dead product — it would suggest the value is in the Ritual and the record, and the Loop should shrink further.

## 10. Rough build order

Product sequence only — no technical decisions implied.

1. Event log and the write path for every event type *(everything else depends on this being right)*
2. Character model: domains, identity/momentum/condition, XP and levels
3. Baseline audit
4. The Loop: morning, logging, nightly report
5. Quests: commitments → undertakings → probes → outcomes
6. Marks and evidence
7. The Ritual
8. Seasons: open, close, chapter
9. Attention layer and Life layer
10. Return protocol
11. Two hidden quest rules
12. Self-instrumentation

Steps 1–4 are the smallest thing that can be lived with daily. If motivation flags mid-build, that's the point to start using it for real while continuing.

## 11. Open before the PRD

1. **The nightly report's exact five lines.** Highest-frequency surface in the product, still unspecified. Worth designing word by word.
2. **Season 0 numbers.** XP curve, level costs, rank tenure. Placeholders until four weeks of real data exist — the PRD should mark them explicitly as calibration constants, not fixed schema.
3. **What the morning screen shows when you have no commitments today.** By design there will be such days. It should not look broken or accusatory.
