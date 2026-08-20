import { SystemVoice } from "./SystemVoice";

/** Night (milestone-4-spec.md §6) — the report, rendered in the system's own voice. */
export function NightScreen({ lines }: { lines: string[] }) {
  return (
    <main className="fade-in flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md space-y-3">
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
    </main>
  );
}
