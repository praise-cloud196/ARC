import { BracketedAnnouncement } from "./BracketedAnnouncement";
import { Panel } from "./Panel";
import { SystemVoice } from "./SystemVoice";
import { CommitmentRow } from "./CommitmentRow";
import type { TodaysCommitmentRow } from "@/lib/loop";

/**
 * Night (milestone-4-spec.md §6) — the report, rendered in the system's
 * own voice, inside a System panel headed `[ SYSTEM REPORT ]`
 * (docs/design-revision-v1.md §7). Not bright: the nightly report fires
 * every night, not rarely (§6 — accent-bright is for Marks, hidden quests,
 * rank promotions only). The report lines themselves are unchanged —
 * still exactly what lib/loop.ts computed, same conditional styling.
 *
 * docs/night-access-fix.md §2: below the report, a `<details>` disclosure
 * (no client JS needed to open/close it) reveals the same commitment rows
 * Day would show for the current logical day — the log doesn't actually
 * close until the 6am boundary, so neither should the UI's only way to
 * reach it. This is not a fourth loop state: completing a row here still
 * leaves `selectLoopState` clock-driven, so the screen stays on Night, and
 * the report above is a snapshot computed on this load — it never refreshes
 * itself, but it's already correct again on the next real one.
 */
export function NightScreen({ lines, todaysCommitments }: { lines: string[]; todaysCommitments?: TodaysCommitmentRow[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <Panel ambient header={<BracketedAnnouncement>System Report</BracketedAnnouncement>}>
        <div className="space-y-3 text-center">
          {lines.map((line, i) => (
            <SystemVoice
              key={i}
              as="div"
              size={i === 0 ? "sm" : "base"}
              className={line === "" ? "h-2" : i === 0 ? "text-ink-faint" : "text-ink-muted"}
            >
              {line}
            </SystemVoice>
          ))}
        </div>
      </Panel>

      {todaysCommitments && (
        <details className="w-full max-w-[480px]">
          <summary className="ia-link text-ink-faint block cursor-pointer text-center font-mono text-xs normal-case [&::-webkit-details-marker]:hidden">
            Log something from today
          </summary>
          <div className="mt-4">
            <Panel header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Today</div>}>
              {todaysCommitments.length === 0 ? (
                <p className="font-sans text-ink-muted">Nothing scheduled today.</p>
              ) : (
                <div>
                  {todaysCommitments.map((c) => (
                    <CommitmentRow key={c.id} commitment={c} />
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </details>
      )}
    </main>
  );
}
