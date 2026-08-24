"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { setStance, type StanceValue } from "@/lib/stances";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

/**
 * One action for both declaring a new behaviour and changing an existing
 * one's stance — lib/stances.ts's setStance already tells the two apart (by
 * whether the behaviour already has a row) and enforces the season-boundary
 * rule itself, so this only needs to surface the rejection if one occurs.
 *
 * `redirect()` throws internally, so the call must sit outside the
 * try/catch — catching it here would swallow the redirect instead of
 * performing it.
 */
export async function submitStance(formData: FormData): Promise<void> {
  const behaviour = requireString(formData, "behaviour");
  const stance = requireString(formData, "stance") as StanceValue;

  let errorMessage: string | null = null;
  try {
    await withTransaction((client) => setStance(client, { behaviour, stance }));
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Could not change that stance.";
  }

  redirect(errorMessage ? `/stances?error=${encodeURIComponent(errorMessage)}` : "/stances");
}
