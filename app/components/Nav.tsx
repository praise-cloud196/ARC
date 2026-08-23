import Link from "next/link";

/**
 * Persistent navigation between Today, the character sheet, and
 * commitments — the only way to move between them before this existed.
 * Deliberately minimal (milestone-4-spec.md §2: no icons, text only,
 * generous restraint) and deliberately absent from Morning's and Day's
 * hard content rules ("Nothing else" / "No other affordance may be
 * added") in spirit, if not letter: this is wayfinding, not a feature —
 * a thin, fixed strip that doesn't compete with the screen's own content
 * and isn't part of what those rules are guarding against (charts, XP
 * totals, gamification). Not shown on /audit or /login, which are their
 * own separate flows.
 */
export function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-ground">
      <div className="mx-auto flex max-w-xl items-center justify-center gap-6 px-6 py-3">
        <Link href="/" className="font-mono text-xs uppercase tracking-wide2 text-ink-faint">
          Today
        </Link>
        <Link href="/character-sheet" className="font-mono text-xs uppercase tracking-wide2 text-ink-faint">
          Character Sheet
        </Link>
        <Link href="/commitments" className="font-mono text-xs uppercase tracking-wide2 text-ink-faint">
          Commitments
        </Link>
      </div>
    </nav>
  );
}
