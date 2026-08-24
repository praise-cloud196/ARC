/**
 * AGENTS.md hard rule 14: every route needs a visible way out. Screens
 * outside the persistent Nav (app/components/Nav.tsx) — record-keeping
 * screens, the audit wizard — use this instead, styled the same as Nav's
 * own links (no icons, text only).
 *
 * Plain `<a>`, not `next/link`'s `<Link>` — see Nav.tsx's comment: every
 * screen now sits in a Panel, and only a real navigation triggers its
 * arrival/dismiss transition (design-revision-v2.md §6).
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="ia-link mb-8 block font-mono text-xs uppercase tracking-wide2">
      {label}
    </a>
  );
}
