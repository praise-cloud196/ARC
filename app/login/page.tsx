import { Panel } from "@/app/components/Panel";
import { SystemVoice } from "@/app/components/SystemVoice";
import { submitLogin } from "./actions";

/** design-revision-v2.md §1: sits in a Panel like every other screen now. Narrow (`size="loop"`, the default) — one small form, nothing to grid. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;
  const failed = params.error === "1";
  const redirectTo = params.redirectTo ?? "/";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Panel header={<div className="text-ink-faint text-center font-mono text-[10px] uppercase tracking-[0.2em]">ARC</div>}>
        <form action={submitLogin} className="space-y-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label className="block space-y-2">
            <SystemVoice size="sm">Password</SystemVoice>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="ia w-full rounded border border-border bg-surface p-3 font-sans text-ink"
            />
          </label>
          {failed && <p className="font-sans text-sm text-ink-muted">Incorrect password.</p>}
          <button
            type="submit"
            className="ia w-full border border-accent-dim px-4 py-2 font-mono text-sm uppercase tracking-wide2 text-accent"
          >
            Enter
          </button>
        </form>
      </Panel>
    </main>
  );
}
