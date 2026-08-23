"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { declareCommitment, type CommitmentDomain } from "@/lib/commitments";
import { startOfWeek } from "@/lib/day-math";
import { computeLogicalDay, getTimezone } from "@/lib/logical-day";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

export async function submitDeclareCommitment(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as CommitmentDomain;
  const label = requireString(formData, "label");
  const tier = Number(requireString(formData, "tier")) as 1 | 2 | 3;
  const weeklyTarget = Number(requireString(formData, "weeklyTarget"));
  const weekStart = startOfWeek(computeLogicalDay(new Date(), getTimezone()));

  await withTransaction((client) => declareCommitment(client, { domain, label, tier, weeklyTarget, weekStart }));
  redirect("/commitments");
}
