import { CommitmentRow, type CommitmentRowData } from "./CommitmentRow";
import { Panel } from "./Panel";
import { CarryOverPrompt } from "./CarryOverPrompt";
import { ModeGlow } from "./ModeGlow";

/**
 * Day (docs/design-revision-v1.md §7): commitment rows inside a panel.
 * Tapping completes and reveals the three resistance options inline
 * (CommitmentRow). Still no other affordance may be added to this screen
 * (milestone-4-spec.md §5). Not vertically centred like Morning/Night —
 * this is a list, and can run longer than one screen.
 */
export function DayScreen({
  commitments,
  lastMarkDay,
  carryableLabels = [],
}: {
  commitments: CommitmentRowData[];
  lastMarkDay?: string | null;
  carryableLabels?: string[];
}) {
  return (
    <main className="px-6 py-16">
      <ModeGlow mode="day" />
      <Panel
        mode="day"
        ambient
        header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">Today</div>}
      >
        {commitments.length === 0 ? (
          <p className="font-sans text-ink-muted">Nothing scheduled today.</p>
        ) : (
          <div>
            {commitments.map((c) => (
              <CommitmentRow key={c.id} commitment={c} />
            ))}
          </div>
        )}
        {commitments.length === 0 && <CarryOverPrompt labels={carryableLabels} />}
        {lastMarkDay && <p className="text-ink-faint mt-4 font-mono text-xs">Last milestone: {lastMarkDay}</p>}
      </Panel>
    </main>
  );
}
