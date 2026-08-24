"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/with-transaction";
import { recordMark } from "@/lib/marks";
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
