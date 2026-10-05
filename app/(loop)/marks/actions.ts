"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { recordMark, editMark, voidMark } from "@/lib/marks";
import type { Domain } from "@/lib/domains";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

/**
 * docs/milestone-6-spec.md §1: label and URL are required together — one
 * without the other isn't a Reference. Left blank entirely, it's just an
 * undocumented Mark.
 */
function readReference(formData: FormData): { label: string; url: string } | undefined {
  const label = formData.get("referenceLabel");
  const url = formData.get("referenceUrl");
  const trimmedLabel = typeof label === "string" ? label.trim() : "";
  const trimmedUrl = typeof url === "string" ? url.trim() : "";
  if (trimmedLabel === "" && trimmedUrl === "") return undefined;
  if (trimmedLabel === "" || trimmedUrl === "") {
    throw new Error("A reference needs both a label and a URL.");
  }
  return { label: trimmedLabel, url: trimmedUrl };
}

export async function submitMark(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as Domain;
  const note = requireString(formData, "note");
  const reference = readReference(formData);

  await withTransaction((client) => recordMark(client, { domain, note, reference }));
  redirect("/marks?recorded=1");
}

/** design-revision-v2.md §7.1/§7.3: a Mark is a record — editable at any time. */
export async function submitEditMark(formData: FormData): Promise<void> {
  const markEventId = requireString(formData, "markEventId");
  const note = requireString(formData, "note");
  const reference = readReference(formData);

  await withTransaction((client) => editMark(client, { markEventId, note, reference }));
  redirect("/marks");
}

/** design-revision-v2.md §7.1/§7.3: Remove is always a void, never a delete. */
export async function submitVoidMark(formData: FormData): Promise<void> {
  const markEventId = requireString(formData, "markEventId");
  await withTransaction((client) => voidMark(client, { markEventId }));
  redirect("/marks");
}
