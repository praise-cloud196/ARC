import Link from "next/link";

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
 */
const LINKS = [
  { href: "/", label: "Today" },
  { href: "/character-sheet", label: "Character Sheet" },
  { href: "/commitments", label: "Commitments" },
] as const;

export function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-ground">
      <div className="mx-auto flex max-w-xl items-center justify-center gap-6 px-6 py-3">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="font-mono text-xs uppercase tracking-wide2 text-ink-faint">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
