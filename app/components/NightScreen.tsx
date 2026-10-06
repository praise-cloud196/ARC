import { Panel } from "./Panel";
import { CommitmentRow } from "./CommitmentRow";
import { ModeGlow } from "./ModeGlow";
import type { TodaysCommitmentRow } from "@/lib/loop";
import type { NightSummary } from "@/lib/report";

/**
 * Night: the day in a few sentences, under a moon and a scatter of stars.
 * The panel frame, corner marks and mono day line are the same system as
 * every other screen; the content is written as sentences (lib/report.ts's
 * composeNightSummary) rather than report lines.
 *
 * docs/night-access-fix.md §2: below the summary, a `<details>` disclosure
 * (no client JS) reveals the same commitment rows Day would show — the log
 * doesn't close until the 6am boundary, so neither does the UI's only way
 * to reach it. Not a fourth loop state.
 */
export function NightScreen({
  summary,
  todaysCommitments,
}: {
  summary: NightSummary;
  todaysCommitments?: TodaysCommitmentRow[];
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <ModeGlow mode="night" />
      <Panel
        mode="night"
        ambient
        header={<div className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#7E8AB8]">{summary.dayLine}</div>}
      >
        <div className="relative text-center">
          <svg
            aria-hidden
            viewBox="0 0 300 90"
            className="pointer-events-none absolute -top-2 left-1/2 h-[90px] w-full max-w-[420px] -translate-x-1/2"
          >
            <circle cx="28" cy="18" r="1.3" fill="#8F9BCB" />
            <circle cx="72" cy="42" r="1" fill="#6F7AA8" />
            <circle cx="108" cy="12" r="1.6" fill="#B9C3F0" />
            <circle cx="214" cy="30" r="1" fill="#8F9BCB" />
            <circle cx="250" cy="10" r="1.4" fill="#B9C3F0" />
            <circle cx="274" cy="48" r="1" fill="#6F7AA8" />
            <circle cx="40" cy="70" r="1.1" fill="#8F9BCB" />
            <circle cx="262" cy="76" r="1.2" fill="#8F9BCB" />
          </svg>
          <div
            aria-hidden
            className="relative mx-auto mb-5 mt-6 h-9 w-9 rounded-full bg-[#E8E2C9]"
            style={{ boxShadow: "inset -10px -2px 0 0 #0B1020" }}
          />
          <p className="font-sans text-[28px] font-medium leading-tight text-[#E8E6F5]">{summary.headline}</p>
          <div className="mt-3 space-y-1.5">
            {summary.sentences.map((sentence, i) => (
              <p key={i} className="font-sans text-[15px] leading-relaxed text-[#9AA3CC]">
                {sentence}
              </p>
            ))}
          </div>
        </div>
      </Panel>

      {todaysCommitments && (
        <details className="w-full max-w-[480px]">
          <summary className="mx-auto block w-fit cursor-pointer rounded-full border border-[#3A4570] px-5 py-2 text-center font-sans text-sm text-[#B9C3F0] hover:border-[#6F7AA8] [&::-webkit-details-marker]:hidden">
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
