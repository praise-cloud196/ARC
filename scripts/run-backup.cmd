@echo off
REM Wrapper for Windows Task Scheduler (docs/milestone-2.1-fixes.md "Also
REM before milestone 3" — scheduled pg_dump-equivalent to a file kept
REM outside the repo). Task Scheduler doesn't run with this project's normal
REM shell PATH/cwd, so this pins both explicitly before calling `npm run
REM backup`, and logs output since a scheduled task's own output is
REM otherwise easy to lose track of.
cd /d "C:\dev\arc"
"C:\Program Files\nodejs\npm.cmd" run backup >> "%USERPROFILE%\arc-backups\backup.log" 2>&1
