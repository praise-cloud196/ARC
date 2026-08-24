import Link from "next/link";

/**
 * AGENTS.md hard rule 14: every route needs a visible way out. Screens
 * outside the persistent Nav (app/components/Nav.tsx) — record-keeping
 * screens, the audit wizard — use this instead, styled the same as Nav's
 * own links (no icons, text only).
 *
 * `realNav`: renders a plain `<a>` instead of `<Link>`. Only needed when
 * the destination is the panel-bearing Today route (`/`) — a real
 * navigation is what makes its dismiss/arrive transition fire
 * (docs/design-revision-v1.md §5b; see globals.css's screen-transition
 * comment and Nav.tsx, which makes the same choice for its own links).
 */
export function BackLink({ href, label, realNav = false }: { href: string; label: string; realNav?: boolean }) {
  const className = "text-ink-faint mb-8 block font-mono text-xs uppercase tracking-wide2";
  return realNav ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
