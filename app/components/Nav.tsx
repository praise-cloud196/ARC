"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Persistent navigation between Today, the character sheet, and
 * commitments — the daily loop's three screens, and the only way to move
 * between them. Deliberately minimal (milestone-4-spec.md §2: no icons,
 * text only, generous restraint) and deliberately absent from Morning's
 * and Day's hard content rules ("Nothing else" / "No other affordance may
 * be added") in spirit, if not letter: this is wayfinding, not a feature —
 * a thin, fixed strip that doesn't compete with the screen's own content
 * and isn't part of what those rules are guarding against (charts, XP
 * totals, gamification). Not shown on /audit or /login, which are their
 * own separate flows.
 *
 * Record-keeping screens (Marks, Metrics, Stances) are deliberately not
 * here — they're not a daily action, so they live as links on the
 * character sheet instead of competing with the Loop's three screens for
 * space on the morning screen.
 *
 * "use client" only for `usePathname()`, which decides `<a>` vs `<Link>`
 * per link below (docs/design-revision-v1.md §5b — see globals.css's
 * screen-transition comment for why that split exists at all: a real
 * `<a>` navigation is what makes Today's panel dismiss/arrive; Next's
 * `<Link>` soft nav never triggers it). No transition timing or DOM
 * detection logic lives here — just which anchor to render.
 */
const LINKS = [
  { href: "/", label: "Today" },
  { href: "/character-sheet", label: "Character Sheet" },
  { href: "/commitments", label: "Commitments" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const onToday = pathname === "/";

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-ground">
      <div className="mx-auto flex max-w-xl items-center justify-center gap-6 px-6 py-3">
        {LINKS.map((link) => {
          const className = "font-mono text-xs uppercase tracking-wide2 text-ink-faint";
          // Real navigation is needed whenever the panel route is on
          // either end: arriving at Today (always), or leaving it
          // (only when currently on Today).
          const needsRealNav = link.href === "/" || onToday;
          return needsRealNav ? (
            <a key={link.href} href={link.href} className={className}>
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className={className}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
