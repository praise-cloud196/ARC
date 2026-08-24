"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { recordNote, editNote, voidNote } from "@/lib/notes";
import type { Domain } from "@/lib/domains";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

export async function submitNote(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as Domain;
  const note = requireString(formData, "note");

  await withTransaction((client) => recordNote(client, { domain, note }));
  redirect("/notes");
}

/** design-revision-v2.md §7.1/§7.3: a note is a record — editable at any time. */
export async function submitEditNote(formData: FormData): Promise<void> {
  const noteEventId = requireString(formData, "noteEventId");
  const note = requireString(formData, "note");

  await withTransaction((client) => editNote(client, { noteEventId, note }));
  redirect("/notes");
}

/** design-revision-v2.md §7.1/§7.3: Remove is always a void, never a delete. */
export async function submitVoidNote(formData: FormData): Promise<void> {
  const noteEventId = requireString(formData, "noteEventId");
  await withTransaction((client) => voidNote(client, { noteEventId }));
  redirect("/notes");
}
