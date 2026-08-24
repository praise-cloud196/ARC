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

export async function submitMark(formData: FormData): Promise<void> {
  const domain = requireString(formData, "domain") as Domain;
  const note = requireString(formData, "note");
  const artifact = formData.get("artifact");

  await withTransaction((client) =>
    recordMark(client, {
      domain,
      note,
      artifact: typeof artifact === "string" && artifact.trim() !== "" ? artifact.trim() : undefined,
    })
  );
  redirect("/marks");
}

/** design-revision-v2.md §7.1/§7.3: a Mark is a record — editable at any time. */
export async function submitEditMark(formData: FormData): Promise<void> {
  const markEventId = requireString(formData, "markEventId");
  const note = requireString(formData, "note");
  const artifact = formData.get("artifact");

  await withTransaction((client) =>
    editMark(client, {
      markEventId,
      note,
      artifact: typeof artifact === "string" && artifact.trim() !== "" ? artifact.trim() : undefined,
    })
  );
  redirect("/marks");
}

/** design-revision-v2.md §7.1/§7.3: Remove is always a void, never a delete. */
export async function submitVoidMark(formData: FormData): Promise<void> {
  const markEventId = requireString(formData, "markEventId");
  await withTransaction((client) => voidMark(client, { markEventId }));
  redirect("/marks");
}
