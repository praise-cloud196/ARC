"use server";

import { revalidatePath } from "next/cache";
import { withTransaction } from "@/lib/with-transaction";
import {
  completeCommitment,
  patchCommitmentCompletion,
  voidCommitmentCompletion,
  type ResistanceLevel,
} from "@/lib/commitments";

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
