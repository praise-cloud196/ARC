import type { ReactNode } from "react";

/**
 * design-revision-v2.md §2: lists of like items become framed cells in a
 * grid rather than rows separated by hairlines. Corner marks at 25%
 * opacity — quieter than the parent Panel's 40%, static (no breathing;
 * see Panel.tsx's comment on why ambient motion doesn't nest) — so
 * nested chrome recedes instead of turning the screen to noise.
 *
 * Does not apply to Day screen commitment rows (a checklist being worked
 * through, not a collection being surveyed) — those keep their existing
 * full-width row markup untouched.
 */
export function GridCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="border-accent/25 pointer-events-none absolute -left-1 -top-1 h-3 w-3 border-l border-t" />
      <span className="border-accent/25 pointer-events-none absolute -right-1 -top-1 h-3 w-3 border-r border-t" />
      <span className="border-accent/25 pointer-events-none absolute -bottom-1 -left-1 h-3 w-3 border-b border-l" />
      <span className="border-accent/25 pointer-events-none absolute -bottom-1 -right-1 h-3 w-3 border-b border-r" />
      <div className="border-border bg-panel rounded-sm border p-3">{children}</div>
    </div>
  );
}

/** 2 columns ≥768px, 1 column below (design-revision-v2.md §2). */
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>{children}</div>;
}
