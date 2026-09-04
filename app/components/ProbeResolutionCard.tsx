"use client";

import { useState, useTransition } from "react";
import { resolveProbeAction } from "@/app/actions";
import { SystemVoice } from "./SystemVoice";
import type { Probe } from "@/lib/quests";

/**
 * milestone-5-spec.md §4/§7, architecture-and-ux-v1.0.md §4.4: "double down
 * / fold / extend once" with identical visual weight (PRD §13) — none of
 * the three is styled as the default or the recommended choice. Shared by
 * the Morning screen's card and the Quests screen's Probes section.
 */
export function ProbeResolutionCard({ probe }: { probe: Probe }) {
  const [resolved, setResolved] = useState(false);
  const [mode, setMode] = useState<"choose" | "fold" | "extend">("choose");
  const [note, setNote] = useState("");
  const [newDecisionDate, setNewDecisionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (resolved) return null;

  const doubleDown = () => {
    startTransition(async () => {
      await resolveProbeAction(probe.id, "double_down");
      setResolved(true);
    });
  };

  const fold = () => {
    if (note.trim() === "") {
      setError("What was learned? Required to fold.");
      return;
    }
    startTransition(async () => {
      await resolveProbeAction(probe.id, "fold", { note: note.trim() });
      setResolved(true);
    });
  };

  const extend = () => {
    if (!newDecisionDate) {
      setError("A new decision date is required to extend.");
      return;
    }
    startTransition(async () => {
      await resolveProbeAction(probe.id, "extend", { newDecisionDate });
      setResolved(true);
    });
  };

  return (
    <div className="border border-border p-4">
      <SystemVoice size="sm" className="text-ink-muted">
        Probe decision due
      </SystemVoice>
      <p className="font-sans text-ink mt-2">{probe.statement}</p>
      <p className="text-ink-faint mt-1 font-mono text-xs">
        Decision date {probe.decisionDate} &middot; Signal: {probe.signal}
      </p>

      {mode === "choose" && (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={doubleDown}
            disabled={isPending}
            className="ia border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-ink"
          >
            Double down
          </button>
          <button
            type="button"
            onClick={() => setMode("fold")}
            disabled={isPending}
            className="ia border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-ink"
          >
            Fold
          </button>
          <button
            type="button"
            onClick={() => setMode("extend")}
            disabled={isPending}
            className="ia border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-ink"
          >
            Extend
          </button>
        </div>
      )}

      {mode === "fold" && (
        <div className="mt-3 space-y-2">
          <SystemVoice size="sm">What was learned?</SystemVoice>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="ia w-full border border-border bg-surface p-2 font-sans text-ink text-sm"
          />
          {error && <p className="font-sans text-ink-muted text-xs">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={fold}
              disabled={isPending}
              className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent"
            >
              Confirm fold
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="ia-link font-mono text-xs uppercase tracking-wide2"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {mode === "extend" && (
        <div className="mt-3 space-y-2">
          <SystemVoice size="sm">New decision date</SystemVoice>
          <input
            type="date"
            value={newDecisionDate}
            onChange={(e) => setNewDecisionDate(e.target.value)}
            className="ia border border-border bg-surface p-2 font-sans text-ink text-sm"
          />
          {error && <p className="font-sans text-ink-muted text-xs">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={extend}
              disabled={isPending}
              className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent"
            >
              Confirm extend
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="ia-link font-mono text-xs uppercase tracking-wide2"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
