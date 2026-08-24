import type { ReactNode } from "react";

const MAX_WIDTH = {
  // Today's three states — centring, scale, generous space (§0: "Only the
  // Loop states get compositional attention").
  loop: "max-w-[480px]",
  // Everywhere else (design-revision-v2.md §1) — wide enough that §2's
  // 2-column grid (≥768px viewport) has real room once it kicks in.
  wide: "max-w-3xl",
} as const;

/**
 * The System as an object (docs/design-revision-v1.md, extended to every
 * screen by design-revision-v2.md §1: "the frame is universal, the
 * content is not"). A framed panel with an edge, a header, and a moment
 * of arrival.
 *
 * `size="loop"` (default) is Today's narrow, centred panel; `size="wide"`
 * is for every other screen, which needs room for §2's grid. `ambient`
 * turns on the two panel-level ambient-motion effects (§4: breathing
 * corner marks, the scan line) — Loop states only; every other screen
 * leaves it off, both because §4 scopes those two effects to "the active
 * panel" alongside a sibling effect explicitly scoped to Loop states, and
 * because §4 separately prohibits ambient motion "on a form screen" —
 * reading "the active panel" as "Loop states only" is what keeps those
 * two lines from contradicting each other.
 *
 * The arrival animation and header sweep are pure CSS (globals.css's
 * `panel-arrive` / `panel-sweep`), so this can stay a Server Component:
 * each real page load is a fresh DOM mount, which is exactly when a CSS
 * `animation` plays — "fires once on mount" falls out for free, no client
 * JS or re-render tracking required. `prefers-reduced-motion` is handled
 * in the same stylesheet, for every animation here including the ambient
 * ones.
 *
 * Screen transitions (v1 §5b) use the browser's native *cross-document*
 * view transition (`@view-transition { navigation: auto }` in
 * globals.css), not React's `<ViewTransition>` — that component only
 * ever engages for client-side navigation into a route the browser can
 * resolve quickly (prefetched/cacheable content). `/` is deliberately
 * `force-dynamic` (live server time and DB state), so it never
 * qualifies, confirmed by directly instrumenting
 * `document.startViewTransition` and watching it simply never fire for
 * this route, restructured with Suspense or not. Two isolated tests
 * proved the cross-document mechanism is the one that actually works
 * here: it fires on a *hard* navigation regardless of `force-dynamic`.
 * `[view-transition-name:panel-transition]` below is what makes that a
 * real navigation animate *this* element specifically — globals.css
 * suppresses the default whole-page crossfade so the Nav and ground stay
 * put and only the panel itself dismisses/arrives. Every internal link
 * in the product is now a real `<a>` (design-revision-v2.md §6: "the
 * arrival and transition apply to every panel and every navigation"),
 * not `next/link`'s soft nav, which never triggers this.
 */
export function Panel({
  header,
  children,
  className = "",
  size = "loop",
  ambient = false,
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "loop" | "wide";
  ambient?: boolean;
}) {
  const cornerClass = ambient ? "corner-breathe border-accent" : "border-accent/40";

  return (
    <div
      className={`panel-arrive relative mx-auto w-full ${MAX_WIDTH[size]} [view-transition-name:panel-transition] ${className}`}
    >
      {/* Corner marks (v1 §4): 12px L-brackets, accent at 40% (25% when
          nested — GridCell has its own), just outside the edge. */}
      <span className={`${cornerClass} pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 border-l border-t`} />
      <span className={`${cornerClass} pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 border-r border-t`} />
      <span className={`${cornerClass} pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 border-b border-l`} />
      <span className={`${cornerClass} pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 border-b border-r`} />

      <div className="border-border bg-panel rounded-sm border">
        <div className="border-border relative overflow-hidden border-b px-6 py-3">
          {header}
          <span className="panel-sweep bg-accent absolute bottom-0 left-0 h-px w-full" />
          {ambient && <span className="panel-scanline bg-accent pointer-events-none absolute top-0 left-0 h-px w-full" />}
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
