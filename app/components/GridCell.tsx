import type { ReactNode } from "react";

/**
 * design-revision-v2.md §2: lists of like items become framed cells in a
 * grid rather than rows separated by hairlines. Corner marks at 25%
 * opacity — quieter than the parent Panel's 40%, static (no breathing;
 * see Panel.tsx's comment on why ambient motion doesn't nest) — so
 * nested chrome recedes instead of turning the screen to noise.
 *
 * `h-full` on both the outer wrapper and the inner bordered box: the
 * outer already stretches to the row's tallest cell (CSS Grid's default
 * `align-items: stretch`), but without `h-full` the *visible* box — the
 * one with the border and background — only grows to its own content,
 * so unequal-length content still reads as unequal-height cells. Hover
 * gets a border shift to `accent.dim` even on cells with no click
 * target of their own, so the grid still feels alive under the cursor.
 *
 * Does not apply to Day screen commitment rows (a checklist being worked
 * through, not a collection being surveyed) — those keep their existing
 * full-width row markup untouched.
 */
export function GridCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative h-full ${className}`}>
      <span className="border-accent/25 pointer-events-none absolute -left-1 -top-1 h-3 w-3 border-l border-t" />
      <span className="border-accent/25 pointer-events-none absolute -right-1 -top-1 h-3 w-3 border-r border-t" />
      <span className="border-accent/25 pointer-events-none absolute -bottom-1 -left-1 h-3 w-3 border-b border-l" />
      <span className="border-accent/25 pointer-events-none absolute -bottom-1 -right-1 h-3 w-3 border-b border-r" />
      <div className="border-border bg-panel hover:border-accent-dim h-full rounded-sm border p-3 transition-colors duration-150">
        {children}
      </div>
    </div>
  );
}

/**
 * 2 equal-width columns ≥768px, 1 column below (design-revision-v2.md
 * §2). `items-stretch` is CSS Grid's default anyway, but stated
 * explicitly since GridCell's equal-height fix depends on it.
 */
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 ${className}`}>{children}</div>;
}

/**
 * The last cell's className when an odd-length list would otherwise
 * leave a single orphan alone in the final row — spans both columns so
 * that row reads as deliberate rather than a gap. Pass `index`/`length`
 * from the surrounding `.map`; empty string every other position.
 */
export function orphanSpanClass(index: number, length: number): string {
  return index === length - 1 && length % 2 === 1 ? "md:col-span-2" : "";
}
