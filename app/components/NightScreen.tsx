import { BracketedAnnouncement } from "./BracketedAnnouncement";
import { Panel } from "./Panel";
import { SystemVoice } from "./SystemVoice";

/**
 * Night (milestone-4-spec.md §6) — the report, rendered in the system's
 * own voice, inside a System panel headed `[ SYSTEM REPORT ]`
 * (docs/design-revision-v1.md §7). Not bright: the nightly report fires
 * every night, not rarely (§6 — accent-bright is for Marks, hidden quests,
 * rank promotions only). The report lines themselves are unchanged —
 * still exactly what lib/loop.ts computed, same conditional styling.
 */
export function NightScreen({ lines }: { lines: string[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
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
    </main>
  );
}
