# Milestone 3 — Baseline audit, precise spec

*Milestone 3 writes the first real events. After this, every mistake in the log is permanent by design. Complete §0 before starting.*

---

## 0. Before you start: backup hardening

The backup script is correct but three properties are missing.

**0.1 Backups must live off this machine.** `~/arc-backups` sits on the same disk as everything else. A dead or stolen laptop takes the backups with it, which defeats the purpose. Set `ARC_BACKUP_DIR` to a OneDrive-synced path — cloud sync is wrong for code and right for backup files.

**0.2 The dump must be encrypted.** It contains `attention_events` — the private layer, holding exactly the material the user would least want sitting in plaintext in a synced cloud folder. Encrypt the file with `node:crypto` (AES-256-GCM) using a passphrase from `ARC_BACKUP_KEY` in `.env.local`. Roughly twenty lines. Note in the README that losing the passphrase means losing the backups.

**0.3 An untested backup is not a backup.** Add `scripts/restore.ts` that loads a dump into a target database, and prove it once against a scratch Neon branch before milestone 3 writes anything real. Restore has to work against the append-only triggers and the CHECK constraints; find out now, not on the day you need it.

**0.4 Missed runs.** Enable "Run task as soon as possible after a scheduled start is missed" on the Task Scheduler entry. The machine will not always be on at 03:00.

Pruning can wait — the files are small.

---

## 1. New event types required

The audit cannot be represented with the current type set. Add, with `.corrected` variants:

| Type | Table | Purpose |
|---|---|---|
| `metric.recorded` | `events` | A numeric body/other measurement. `payload: { metric, value, unit }`. Domain-scoped. **Zero XP.** |
| `note.recorded` | `events` | An unquantified domain observation — *"I feel stronger"* (PRD §9). Domain-scoped. **Zero XP.** |
| `audit.completed` | `events` | Marks the end of onboarding. Written once. |

`metric.recorded` and `note.recorded` are peers by design: PRD §9 requires a qualitative note to be a first-class entry alongside a number, not a comment attached to one.

Both must be excluded from XP (rule already holds — only `commitment.completed` and `quest.step_completed` award XP) and included in momentum conduct types? **No** — see §5.

## 2. What the audit captures

Linear wizard, resumable, target 20–30 minutes. Resumability is a requirement, not a nicety: this is the longest single interaction in the product and it will be interrupted.

| Step | Writes |
|---|---|
| 1. Domain self-assessment | `note.recorded` per domain, backdated to today |
| 2. Retroactive Marks (min 3) | `mark.recorded`, see §3 |
| 3. Body baseline metrics | `metric.recorded` per metric |
| 4. Stances | `stance.changed` in `attention_events` + rows in the new `stances` table |
| 5. Three 2027 statements | `quest.created` with kind `outcome` + rows in `quests` |
| 6. Season 01 opening | `season.opened` + row in `seasons` |
| — completion | `audit.completed` |

Partial progress is held in the direction tables; events are written per step as the step completes, not batched at the end. A wizard abandoned at step 4 has genuinely recorded steps 1–3.

## 3. Retroactive Marks

`mark.recorded` with:

- `occurred_at` set to the user's best estimate of when it actually happened, which may be years ago
- `payload.retroactive = true`
- `payload.note` — required, answering *"What changed because of this?"* (PRD §14)
- `payload.artifact` — optional

Marks award no XP, so backdating cannot distort the level high-water mark. This is why the audit is safe to run against the progression system at all.

The minimum of three is enforced. The user cannot skip past this step — an empty achievement ledger is the failure mode the audit exists to prevent.

## 4. Stances and the `not_now` filter

This is where AGENTS.md hard rule 10 finally gets implemented.

`stances` table: `behaviour`, `stance` (`observing | reducing | abstaining | not_now`), `created_at`. Changes append `stance.changed` to `attention_events`.

**The filter is at the query layer.** Every read of stances that is not the stance-management screen itself must exclude `not_now`. Not a UI conditional — a `WHERE` clause in the data access function, so a future surface cannot forget it.

Declaring a new behaviour is permitted at any time; changing the stance on one already named is restricted to season boundaries (PRD §16). The audit is Season 01's opening, so setting them here — new or existing — is legitimate.

## 5. What the audit must not do to momentum

The audit writes a burst of events on day one. None of it may register as conduct.

`note.recorded`, `metric.recorded` and `audit.completed` are **excluded** from `MOMENTUM_CONDUCT_EVENT_TYPES`. Reason: completing the audit is not evidence of agency, and a user who does the audit and then disappears for a fortnight should read as Dormant, not Strong. Recording a measurement is likewise not conduct.

`mark.recorded` remains conduct, as already specified.

## 6. Starting rank

PRD §11 says rank is "derived from the audit" without saying how. Deterministic rule:

```
retroDomains = distinct domains containing ≥1 retroactive Mark
retroMarks   = total retroactive Marks

C  if retroDomains ≥ 3 and retroMarks ≥ 6
D  if retroDomains ≥ 2 and retroMarks ≥ 3
E  otherwise
```

**Starting rank is capped at C.** B, A and S cannot be granted by self-report — they exist only to be earned through season closes. This is what keeps the top of the ladder meaningful.

**The user may adjust the proposed rank down, never up.** They can be more modest than the system, never less. Inflation is impossible; understatement is permitted and costs only the timing of the first promotion.

Display the proposal with a one-line explanation of why — *"Marks in 3 domains"* — so the number is legible rather than mysterious.

## 7. Definition of done

- No screen in the app is empty after the audit completes (PRD §11)
- The wizard can be closed at any step and resumed with prior steps intact
- Fewer than three retroactive Marks cannot advance
- `not_now` stances are unreachable from any query other than stance management
- Completing the audit and then doing nothing for 7 days yields Dormant
- Starting rank cannot exceed C, and cannot be adjusted upward
- Backup encrypted, off-machine, and a restore proven before any of this runs
- Rebuild-equivalence still passes
