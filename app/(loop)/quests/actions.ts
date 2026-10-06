"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import {
  abandonQuest,
  achieveOutcome,
  addUndertakingStep,
  completeUndertaking,
  createProbe,
  createUndertaking,
  setOutcomeTitle,
} from "@/lib/quests";
import type { XpTier } from "@/lib/calibration";
import type { Domain } from "@/lib/domains";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * docs/milestone-6-spec.md §1: label and URL are required together — one
 * without the other isn't a Reference. Left blank entirely, it's just an
 * undocumented Mark.
 */
function readReference(formData: FormData): { label: string; url: string } | undefined {
  const label = optionalString(formData, "referenceLabel");
  const url = optionalString(formData, "referenceUrl");
  if (label === undefined && url === undefined) return undefined;
  if (label === undefined || url === undefined) {
    throw new Error("A reference needs both a label and a URL.");
  }
  return { label, url };
}

export async function submitUndertaking(formData: FormData): Promise<void> {
  const statement = requireString(formData, "statement");
  await withTransaction((client) => createUndertaking(client, { statement }));
  redirect("/quests");
}

export async function submitUndertakingStep(formData: FormData): Promise<void> {
  const undertakingId = requireString(formData, "undertakingId");
  const tier = Number(requireString(formData, "tier")) as XpTier;
  await withTransaction((client) => addUndertakingStep(client, { undertakingId, tier }));
  redirect("/quests");
}

export async function submitCompleteUndertaking(formData: FormData): Promise<void> {
  const undertakingId = requireString(formData, "undertakingId");
  const note = optionalString(formData, "note");
  const reference = readReference(formData);
  await withTransaction((client) => completeUndertaking(client, { undertakingId, note, reference }));
  redirect("/quests");
}

export async function submitProbe(formData: FormData): Promise<void> {
  const statement = requireString(formData, "statement");
  const decisionDate = requireString(formData, "decisionDate");
  const signal = requireString(formData, "signal");
  await withTransaction((client) => createProbe(client, { statement, decisionDate, signal }));
  redirect("/quests");
}

export async function submitAchieveOutcome(formData: FormData): Promise<void> {
  const outcomeId = requireString(formData, "outcomeId");
  const domain = requireString(formData, "domain") as Domain;
  const note = requireString(formData, "note");
  const reference = readReference(formData);
  await withTransaction((client) => achieveOutcome(client, { outcomeId, domain, note, reference }));
  redirect("/quests");
}

export async function submitGoalTitle(formData: FormData): Promise<void> {
  const outcomeId = requireString(formData, "outcomeId");
  const title = optionalString(formData, "title") ?? "";
  await withTransaction((client) => setOutcomeTitle(client, outcomeId, title));
  redirect("/quests");
}

export async function submitAbandonQuest(formData: FormData): Promise<void> {
  const questId = requireString(formData, "questId");
  const note = optionalString(formData, "note");
  await withTransaction((client) => abandonQuest(client, { questId, note }));
  redirect("/quests");
}
