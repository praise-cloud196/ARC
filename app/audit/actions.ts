"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { recordNote } from "@/lib/notes";
import { recordRetroactiveMark } from "@/lib/marks";
import { recordMetric } from "@/lib/metrics";
import { setStance, type StanceValue } from "@/lib/stances";
import { recordOutcome } from "@/lib/quests";
import { openSeason } from "@/lib/seasons";
import { completeAudit } from "@/lib/audit";
import { DOMAINS, type Domain } from "@/lib/domains";
import type { Rank } from "@/lib/calibration";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

export async function submitDomainNotes(formData: FormData): Promise<void> {
  await withTransaction(async (client) => {
    for (const domain of DOMAINS) {
      const note = requireString(formData, `note-${domain}`);
      await recordNote(client, { domain, note });
    }
  });
  redirect("/audit?step=marks");
}

export async function submitRetroactiveMark(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as Domain;
  const occurredAt = requireString(formData, "occurredAt");
  const note = requireString(formData, "note");
  const artifact = formData.get("artifact");

  await withTransaction((client) =>
    recordRetroactiveMark(client, {
      domain: domain as Exclude<Domain, "life">,
      occurredAt: new Date(`${occurredAt}T12:00:00`),
      note,
      artifact: typeof artifact === "string" && artifact.trim() !== "" ? artifact.trim() : undefined,
    })
  );
  redirect("/audit?step=marks");
}

export async function continueFromMarks(): Promise<void> {
  redirect("/audit?step=metrics");
}

export async function submitMetric(formData: FormData): Promise<void> {
  const metric = requireString(formData, "metric");
  const value = Number(requireString(formData, "value"));
  const unit = requireString(formData, "unit");
  if (!Number.isFinite(value)) throw new Error("value must be a number.");

  await withTransaction((client) => recordMetric(client, { domain: "body", metric, value, unit }));
  redirect("/audit?step=metrics");
}

export async function continueFromMetrics(): Promise<void> {
  redirect("/audit?step=stances");
}

export async function submitStance(formData: FormData): Promise<void> {
  const behaviour = requireString(formData, "behaviour");
  const stance = requireString(formData, "stance") as StanceValue;

  await withTransaction((client) => setStance(client, { behaviour, stance }));
  redirect("/audit?step=stances");
}

export async function continueFromStances(): Promise<void> {
  redirect("/audit?step=outcomes");
}

export async function submitOutcomes(formData: FormData): Promise<void> {
  const statements = [
    requireString(formData, "statement-1"),
    requireString(formData, "statement-2"),
    requireString(formData, "statement-3"),
  ];

  await withTransaction(async (client) => {
    for (const statement of statements) {
      await recordOutcome(client, { statement });
    }
  });
  redirect("/audit?step=season");
}

export async function submitOpenSeason(): Promise<void> {
  await withTransaction((client) => openSeason(client, { number: 1 }));
  redirect("/audit?step=rank");
}

export async function submitCompleteAudit(formData: FormData): Promise<void> {
  const startingRank = requireString(formData, "startingRank") as Rank;
  await withTransaction((client) => completeAudit(client, { startingRank }));
  redirect("/character-sheet");
}
