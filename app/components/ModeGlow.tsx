/**
 * Soft background light behind Today's panel, different per state: from
 * above in Morning, absent in Day, faint from below in Night. Fixed behind
 * everything; purely decorative (globals.css, `.mode-glow`).
 */
export function ModeGlow({ mode }: { mode: "morning" | "day" | "night" }) {
  return <div aria-hidden data-mode={mode} className="mode-glow" />;
}
