# ARC

See `AGENTS.md` for the rules this codebase is built under, and `docs/` for the product spec.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in `DATABASE_URL` (Neon) and `ARC_TIMEZONE` (IANA zone; required, no default).
2. `npm install`
3. `npm run migrate` — applies pending files in `db/migrations/` in order.
4. `npm run dev`

## Database

Schema changes live in `db/migrations/*.sql`, applied in order and tracked in `schema_migrations`. `db/schema.sql` is a generated reference of the current cumulative state — edit it for documentation, but a schema change happens by adding a new migration file, never by editing that file and re-running it.

`npm run migrate` refuses to run if `events` or `attention_events` already hold data, since a migration isn't covered by the append-only triggers (those block UPDATE/DELETE, not schema changes) and there's no way to guarantee a pending migration is non-destructive. Override with `ARC_ALLOW_DESTRUCTIVE_MIGRATION=1` — deliberately not a casual flag.

`npm run rebuild` drops and recomputes `daily_rollup` from the event log. This is always safe: the rollup is a cache, never a source of truth.

## Backups

The event log (`events`, `attention_events`) is the only irreplaceable data in this product — everything else is derived or can be re-declared. Neon point-in-time restore is the backstop if the migration guard above is ever overridden incorrectly or bypassed.

**Confirm before real data exists (before the milestone 3 baseline audit):** that PITR is enabled on this Neon project, and record the actual retention window here.

- Project: `gentle-violet-22128593` (`neon.project_id`), branch `br-restless-salad-ax08xdzq` (`neon.branch_id`) — confirmed by querying `pg_settings` directly against the database. Neither Postgres nor `pg_settings` exposes PITR/restore-window configuration itself — that lives in the Neon control plane, not the compute — and `neonctl` needs an interactive browser login this environment can't complete, so an agent cannot confirm the rest unattended.
- PITR enabled: _unconfirmed — check the [Neon console](https://console.neon.tech/app/projects/gentle-violet-22128593) → Project → Settings → Backup/Restore_
- Retention window: _unconfirmed_
