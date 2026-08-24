import type { ReactNode } from "react";

/**
 * A panel header's system-event style (docs/design-revision-v1.md §6):
 * `[ SYSTEM REPORT ]`, `[ MARK RECORDED ]`, etc. `bright` (--accent-bright)
 * is reserved for the rare ones — Marks, hidden quests, rank promotions.
 * Anything that fires routinely (the nightly report) uses the ordinary
 * accent.
 */
export function BracketedAnnouncement({ children, bright = false }: { children: ReactNode; bright?: boolean }) {
  return (
    <div
      className={`text-center font-mono text-[11px] uppercase tracking-[0.25em] ${
        bright ? "text-accent-bright" : "text-accent"
      }`}
    >
      [ {children} ]
    </div>
  );
}
