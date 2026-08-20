/**
 * The four life domains (PRD §8). Fixed in v1; frozen during a season
 * (PRD §15).
 *
 * `"attention"` here is the *domain* named "Attention / Inner life" — a
 * normal, scored domain whose primary objects are Commitments and Stances.
 * It is unrelated to *the Attention layer* (`attention_events`,
 * lib/attention-events.ts), which is the separate, private surface for
 * behaviours the user is trying to reduce (architecture doc §2.7, PRD §16).
 * The PRD uses the same word for both; the code does too, but they must
 * never be confused for one another.
 */
export const DOMAINS = ["career", "body", "attention", "life"] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * Domains XP, levels, and dormancy apply to. "life" (Life/Relationships) is
 * unscored by design and visibly so (PRD §8) — no XP, no level, no
 * dormancy display; it has its own unscored Life layer instead (PRD §17).
 */
export const SCORED_DOMAINS = ["career", "body", "attention"] as const;

export type ScoredDomain = (typeof SCORED_DOMAINS)[number];

export function isScoredDomain(domain: string): domain is ScoredDomain {
  return (SCORED_DOMAINS as readonly string[]).includes(domain);
}
