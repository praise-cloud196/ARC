import Link from "next/link";

/**
 * AGENTS.md hard rule 14: every route needs a visible way out. Screens
 * outside the persistent Nav (app/components/Nav.tsx) — record-keeping
 * screens, the audit wizard — use this instead, styled the same as Nav's
 * own links (no icons, text only).
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-ink-faint mb-8 block font-mono text-xs uppercase tracking-wide2">
      {label}
    </Link>
  );
}
