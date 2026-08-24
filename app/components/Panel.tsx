import type { ReactNode } from "react";

/**
 * The System as an object (docs/design-revision-v1.md) — a framed panel
 * with an edge, a header, and a moment of arrival. Used only by the three
 * Loop states (Morning/Day/Night) and system messages (§1, §8) — never
 * reach for this from a form or any other screen; those stay plain.
 *
 * The arrival animation and header sweep are pure CSS (globals.css's
 * `panel-arrive` / `panel-sweep`), so this can stay a Server Component:
 * each real page load is a fresh DOM mount, which is exactly when a CSS
 * `animation` plays — "fires once on mount" falls out for free, no client
 * JS or re-render tracking required. `prefers-reduced-motion` is handled
 * in the same stylesheet.
 */
export function Panel({
  header,
  children,
  className = "",
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel-arrive relative mx-auto w-full max-w-[480px] ${className}`}>
      {/* Corner marks (§4): 12px L-brackets, accent at 40%, just outside the edge. */}
      <span className="border-accent/40 pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t" />
      <span className="border-accent/40 pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t" />
      <span className="border-accent/40 pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l" />
      <span className="border-accent/40 pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r" />

      <div className="border-border bg-panel rounded-sm border">
        <div className="border-border relative overflow-hidden border-b px-6 py-3">
          {header}
          <span className="panel-sweep bg-accent absolute bottom-0 left-0 h-px w-full" />
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
