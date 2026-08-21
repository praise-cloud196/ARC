"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, computeAuthToken } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function submitLogin(formData: FormData): Promise<void> {
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");
  const destination = typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : "/";

  const configured = process.env.AUTH_PASSWORD;
  if (!configured || typeof password !== "string" || password !== configured) {
    redirect(`/login?error=1&redirectTo=${encodeURIComponent(destination)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, computeAuthToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });

  redirect(destination);
}
