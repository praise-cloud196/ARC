import { submitCarryOver } from "@/app/(loop)/commitments/actions";

/**
 * Shown on Today / Morning when the current week has no commitments but
 * last week's can be copied across in one tap.
 */
export function CarryOverPrompt({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <form action={submitCarryOver} className="mt-4 text-center">
      <input type="hidden" name="next" value="/" />
      <button type="submit" className="ia border border-accent-dim px-4 py-2 font-mono text-xs uppercase tracking-wide2 text-accent">
        Copy last week ({labels.length})
      </button>
      <p className="text-ink-faint mt-2 text-xs">{labels.join(", ")}</p>
    </form>
  );
}
