# Milestone 1.2 — two corrections

*Review of milestone 1.1. Item 1 must be fixed before any real data exists — that is, before the milestone 3 baseline audit writes the first events.*

---

## 1. `npm run migrate` destroys the event log

**Severity: critical.**

`db/schema.sql` opens with:

```sql
DROP TABLE IF EXISTS daily_rollup;
DROP TABLE IF EXISTS events;
```

and `scripts/migrate.ts` applies the file wholesale with no guard. The append-only triggers protect against UPDATE and DELETE; they do not protect against DROP.

So a single accidental `npm run migrate` — by you, by an agent tidying up, by a deploy script, by a half-remembered command six months from now — silently destroys the only irreplaceable asset in the product. The event log cannot be regenerated from anything. Everything else in this repo can be rebuilt from source; the log cannot.

The schema comment acknowledges this risk. **A comment is not a guard.** The entire premise of the architecture is that history is enforced rather than trusted — the same standard applies here.

Required:

- **Guard `scripts/migrate.ts`**: before applying anything, count rows in `events` and `attention_events`. If either is non-empty, refuse and exit non-zero. Override only via an explicit environment variable such as `ARC_ALLOW_DESTRUCTIVE_MIGRATION=1`, never a flag that could be added casually.
- **Move to incremental migrations**: `db/migrations/0001_init.sql`, `0002_attention_split.sql`, and so on, applied in order with a `schema_migrations` table tracking what has run. `db/schema.sql` becomes a generated reference of current state, not the thing that gets executed.
- **Remove the `DROP TABLE` statements** from anything on the normal execution path.
- **Confirm Neon's point-in-time restore is enabled** on this project and note the retention window in the README. It is the only backstop if all of the above fails.

## 2. `stance.changed` is Attention-layer data in the general log

**Severity: medium.**

Stances exist only for behaviours the user is trying to reduce (philosophy §10). `stance.changed` is therefore Attention-layer data, but it currently lives in `events` and is counted as conduct in `daily_rollup.event_count`.

Two consequences: changing a stance registers as general activity, which can keep the character out of the Dormant state without any real conduct having occurred; and Attention-layer information sits in the table that every Loop-facing aggregate reads from. That is the exact leak item 1 of the previous round was meant to close.

Required:

- Move `stance.changed` and `stance.changed.corrected` to `attention_events`
- Remove both from the `events` CHECK constraint
- Confirm nothing in `lib/rollup.ts` or any future aggregate can observe a stance change

---

## Carry-forward note

The `not_now` filtering gap you flagged is already covered — AGENTS.md hard rule 10 states it as a standing invariant, so it applies whenever the `stances` table is built. Nothing further needed now, but the milestone that introduces stances must implement it at the query layer, not in the UI.

## Definition of done

- `npm run migrate` against a database containing events exits non-zero without executing anything
- Migrations are incremental and tracked
- No `DROP TABLE` on any normal path
- `stance.changed` cannot be observed by any conduct aggregate
- Rebuild-equivalence still passes
- Committed separately
