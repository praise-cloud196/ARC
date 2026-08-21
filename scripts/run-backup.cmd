@echo off
REM Wrapper for Windows Task Scheduler (docs/milestone-2.1-fixes.md "Also
REM before milestone 3" — scheduled pg_dump-equivalent to a file kept
REM outside the repo). Task Scheduler doesn't run with this project's normal
REM shell PATH/cwd, so this pins both explicitly before calling `npm run
REM backup:production`, and logs output since a scheduled task's own output
REM is otherwise easy to lose track of.
REM
REM backup:production, not backup: this job must back up `main` (the real,
REM irreplaceable data), not `dev` (disposable — see
REM docs/milestone-4.1-fixes.md §1). scripts/backup-production.ts loads
REM .env.production instead of the default .env.local.
cd /d "C:\dev\arc"
"C:\Program Files\nodejs\npm.cmd" run backup:production >> "%USERPROFILE%\arc-backups\backup.log" 2>&1
