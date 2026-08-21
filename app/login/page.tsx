import { SystemVoice } from "@/app/components/SystemVoice";
import { submitLogin } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;
  const failed = params.error === "1";
  const redirectTo = params.redirectTo ?? "/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-ink">
      <form action={submitLogin} className="w-full max-w-xs space-y-6">
        <SystemVoice as="div" size="sm" className="text-ink-faint text-center">
          ARC
        </SystemVoice>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="block space-y-2">
          <SystemVoice size="sm">Password</SystemVoice>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded border border-border bg-surface p-3 font-sans text-ink"
          />
        </label>
        {failed && <p className="font-sans text-sm text-ink-muted">Incorrect password.</p>}
        <button
          type="submit"
          className="w-full border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
