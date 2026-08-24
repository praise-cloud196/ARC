"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { recordMetric } from "@/lib/metrics";
import type { Domain } from "@/lib/domains";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

export async function submitMetric(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as Domain;
  const metric = requireString(formData, "metric");
  const value = Number(requireString(formData, "value"));
  const unit = requireString(formData, "unit");
  if (!Number.isFinite(value)) throw new Error("value must be a number.");

  await withTransaction((client) => recordMetric(client, { domain, metric, value, unit }));
  redirect("/metrics");
}
