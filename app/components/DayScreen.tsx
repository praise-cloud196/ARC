import { CommitmentRow, type CommitmentRowData } from "./CommitmentRow";
import { Panel } from "./Panel";

/**
 * Day (docs/design-revision-v1.md §7): commitment rows inside a panel.
 * Tapping completes and reveals the three resistance options inline
 * (CommitmentRow). Still no other affordance may be added to this screen
 * (milestone-4-spec.md §5). Not vertically centred like Morning/Night —
 * this is a list, and can run longer than one screen.
 */
export function DayScreen({ commitments }: { commitments: CommitmentRowData[] }) {
  return (
    <main className="px-6 py-16">
      <Panel
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
      </Panel>
    </main>
  );
}
