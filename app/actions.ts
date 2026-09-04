"use server";

import { revalidatePath } from "next/cache";
import { withTransaction } from "@/lib/with-transaction";
import {
  completeCommitment,
  patchCommitmentCompletion,
  voidCommitmentCompletion,
  type ResistanceLevel,
} from "@/lib/commitments";
import { resolveProbe, type ProbeResolutionAction } from "@/lib/quests";

/** Returns the new completion event's id, for CommitmentRow to patch afterward. */
export async function completeCommitmentAction(commitmentId: string): Promise<string> {
  const event = await withTransaction((client) => completeCommitment(client, { commitmentId }));
  revalidatePath("/");
  return event.id;
}

export async function patchCommitmentAction(
  completionEventId: string,
  patch: { resistance?: ResistanceLevel; note?: string }
): Promise<void> {
  await withTransaction((client) => patchCommitmentCompletion(client, { completionEventId, ...patch }));
  revalidatePath("/");
}

/** design-revision-v2.md §7: withdraws a completion, same-day only (enforced in lib/commitments.ts). */
export async function voidCommitmentAction(completionEventId: string): Promise<void> {
  await withTransaction((client) => voidCommitmentCompletion(client, { completionEventId }));
  revalidatePath("/");
}

/**
 * milestone-5-spec.md §4/§7: shared by the Morning screen's resolution card
 * and the Quests screen's Probes section — one action, two surfaces.
 * Revalidates both routes since either can be the one the user resolved
 * from.
 */
export async function resolveProbeAction(
  probeId: string,
  action: ProbeResolutionAction,
  extra?: { note?: string; newDecisionDate?: string }
): Promise<void> {
  await withTransaction((client) => resolveProbe(client, { probeId, action, ...extra }));
  revalidatePath("/");
  revalidatePath("/quests");
}
