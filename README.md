# ARC

See `AGENTS.md` for the rules this codebase is built under, and `docs/` for the product spec.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in `DATABASE_URL` (Neon, the `dev` branch — see "Environments" below), `ARC_TIMEZONE` (IANA zone; required, no default), and `ARC_PRODUCTION_BRANCH_ID`.
2. `npm install`
3. `npm run migrate` — applies pending files in `db/migrations/` in order.
4. `npm run dev`

## Environments

docs/milestone-4.1-fixes.md §1: the event log is append-only, so development and real use cannot share a database — a mistake made while testing against real data has no undo. Two Neon branches:

- **`main`** (`br-restless-salad-ax08xdzq`) — real data. Written to only by the deployed app itself (Vercel's own environment variables set `DATABASE_URL`, `ARC_TIMEZONE`, etc. there — never in a repo file) and, deliberately, the real baseline audit, once.
- **`dev`** (`br-nameless-base-ax3w44ri`) — disposable. `.env.local` points here. Reset freely; nothing here is precious.

`lib/db-guard.ts` enforces the boundary: `scripts/backup.ts`, `scripts/restore.ts`, `scripts/rebuild.ts`, `scripts/boundary-job.ts`, `scripts/migrate.ts`, and the whole test suite all query `neon.branch_id` from whatever database they're pointed at and refuse to proceed if it matches `ARC_PRODUCTION_BRANCH_ID`, unless `ARC_ALLOW_PRODUCTION_WRITE=1` is set in that specific invocation's environment (same pattern as `ARC_ALLOW_DESTRUCTIVE_MIGRATION` below — deliberately not a casual flag). The one thing that legitimately runs against `main` outside the deployed app is the scheduled production backup (see "Backups"), which sets that flag permanently in its own environment. See `.env.production.example` for what a deliberate one-off run against production (a manual migration, say) needs.

## Database

Schema changes live in `db/migrations/*.sql`, applied in order and tracked in `schema_migrations`. `db/schema.sql` is a generated reference of the current cumulative state — edit it for documentation, but a schema change happens by adding a new migration file, never by editing that file and re-running it.

`npm run migrate` refuses to run if `events` or `attention_events` already hold data, since a migration isn't covered by the append-only triggers (those block UPDATE/DELETE, not schema changes) and there's no way to guarantee a pending migration is non-destructive. Override with `ARC_ALLOW_DESTRUCTIVE_MIGRATION=1` — deliberately not a casual flag.

`npm run rebuild` drops and recomputes `daily_rollup` from the event log. This is always safe: the rollup is a cache, never a source of truth.

## The boundary job

`npm run boundary-job` (`scripts/boundary-job.ts` / `lib/boundary-job.ts`) is the only scheduled job in the product (AGENTS.md hard rule 8, milestone-4-spec.md §6): once per logical day, it writes `commitment.missed` for every commitment whose week just ended without meeting its `weekly_target`, then rebuilds `daily_rollup`.

In production it's triggered by Vercel Cron (`vercel.json`) calling `GET /api/cron/boundary`, authenticated with a bearer token compared against `CRON_SECRET`. The cron schedule (`0 5 * * *`, i.e. 05:00 UTC) is a fixed approximation of `LOGICAL_DAY_BOUNDARY_HOUR` (06:00) in `ARC_TIMEZONE` (`Africa/Lagos`, UTC+1, no DST) — **if either changes, `vercel.json`'s schedule has to be updated by hand**, the same coupling the weekly-lock trigger's `CURRENT_DATE` approximation has (`db/migrations/0007_commitments.sql`).

## Backups

The event log (`events`, `attention_events`) is the only irreplaceable data in this product — everything else is derived or can be re-declared. Neon point-in-time restore is the backstop if the migration guard above is ever overridden incorrectly or bypassed.

`npm run backup` (`scripts/backup.ts`, targets whatever `DATABASE_URL` points at — `dev` when run locally) writes a timestamped, **encrypted** dump of `events` and `attention_events` to `ARC_BACKUP_DIR`, or `~/OneDrive/arc-backups` by default — a cloud-synced folder (docs/milestone-3-spec.md §0.1), not `~/arc-backups`: a backup on the same disk as everything else dies with that disk. A hand-rolled logical dump via the existing `pg` dependency, not `pg_dump`: this machine doesn't have the Postgres client tools installed, and the schema itself is already fully reproducible from `db/migrations/*.sql` in git, so only the data needs covering.

`npm run backup:production` (`scripts/backup-production.ts`) is the same thing against `main` instead — loads `.env.production`, which sets `ARC_ALLOW_PRODUCTION_WRITE=1` so `lib/db-guard.ts` lets it through. This is what the scheduled task below actually runs; `dev` is disposable and not worth backing up long-term (docs/milestone-4.1-fixes.md §1).

Encrypted with AES-256-GCM (`scripts/backup-crypto.ts`) using `ARC_BACKUP_KEY`. **Losing that passphrase means losing the backups.** Keep a copy of it somewhere other than `.env.local`/`.env.production` (neither is ever committed).

`npm run restore -- <dump-file>` (`scripts/restore.ts`, `RESTORE_DATABASE_URL=...`) decrypts a dump and inserts it into a target database that already has the schema applied (`npm run migrate` against that same `RESTORE_DATABASE_URL`). Deliberately reads a separate env var from `DATABASE_URL` so it can never default to overwriting the live database, and is itself guarded against `RESTORE_DATABASE_URL` being production. Proven once (2026-08-20) against two scratch databases — restore, correction resolution, the tier CHECK constraint, and the append-only triggers on the restored rows all round-tripped correctly.

Scheduled daily via Windows Task Scheduler — task `ARC Daily Backup`, running `scripts/run-backup.cmd` (→ `npm run backup:production`) at 03:00 local time, logging to `~/arc-backups/backup.log` (the log itself, not backup data, stays local). "Run task as soon as possible after a scheduled start is missed" is enabled, since the machine won't always be on at 03:00. Inspect or change it with `schtasks /Query /TN "ARC Daily Backup" /V` / Task Scheduler's GUI. This only runs while the machine is on and logged in — it is not a substitute for PITR, only a second, independent copy.

**Confirm before real data exists (before the milestone 3 baseline audit):** that PITR is enabled on this Neon project, and record the actual retention window here.

- Project: `gentle-violet-22128593` (`neon.project_id`), branch `br-restless-salad-ax08xdzq` (`neon.branch_id`) — confirmed by querying `pg_settings` directly against the database. Neither Postgres nor `pg_settings` exposes PITR/restore-window configuration itself — that lives in the Neon control plane, not the compute — and `neonctl` needs an interactive browser login this environment can't complete, so an agent cannot confirm the rest unattended.
- PITR enabled: _unconfirmed — check the [Neon console](https://console.neon.tech/app/projects/gentle-violet-22128593) → Project → Settings → Backup/Restore_
- Retention window: _unconfirmed_
