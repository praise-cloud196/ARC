import { CommitmentRow, type CommitmentRowData } from "./CommitmentRow";
import { SystemVoice } from "./SystemVoice";

export function DayScreen({ commitments }: { commitments: CommitmentRowData[] }) {
  return (
    <main className="fade-in mx-auto max-w-md px-6 py-16">
      <SystemVoice as="div" size="sm" className="text-ink-faint mb-8">
        Today
      </SystemVoice>
      {commitments.length === 0 ? (
        <p className="font-sans text-ink-muted">Nothing scheduled today.</p>
      ) : (
        <div>
          {commitments.map((c) => (
            <CommitmentRow key={c.id} commitment={c} />
          ))}
        </div>
      )}
    </main>
  );
}
