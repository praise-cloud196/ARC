"use client";

import { useState, useTransition } from "react";
import { completeCommitmentAction, patchCommitmentAction, voidCommitmentAction } from "@/app/actions";
import { SystemVoice } from "./SystemVoice";

export interface CommitmentRowData {
  id: string;
  label: string;
  completionEventId: string | null;
  resistance: string | null;
}

const RESISTANCE_OPTIONS: { value: "easy" | "normal" | "against_resistance"; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "normal", label: "Normal" },
  { value: "against_resistance", label: "Against resistance" },
];

/**
 * milestone-4-spec.md §5: one tap completes and immediately reveals the
 * three resistance options inline; completion is already written,
 * resistance patches it via correction. Optional one-line note behind a
 * secondary tap. No other affordance may be added to this screen.
 *
 * design-revision-v2.md §7: Complete writes immediately with no
 * confirmation, so Undo is the safety net for a mis-tap — available for
 * the rest of the logical day (the server enforces this; every row here
 * is already today's, since that's the only data the Day screen ever
 * fetches). Voiding returns the row to its pre-completion state so the
 * commitment can be completed for real if that's what actually happened.
 */
export function CommitmentRow({ commitment }: { commitment: CommitmentRowData }) {
  const [state, setState] = useState(commitment);
  const [showNote, setShowNote] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      const eventId = await completeCommitmentAction(state.id);
      setState((s) => ({ ...s, completionEventId: eventId }));
    });
  };

  const handleResistance = (resistance: "easy" | "normal" | "against_resistance") => {
    if (!state.completionEventId) return;
    startTransition(async () => {
      await patchCommitmentAction(state.completionEventId as string, { resistance });
      setState((s) => ({ ...s, resistance }));
    });
  };

  const handleNote = (note: string) => {
    if (!state.completionEventId || note.trim() === "") return;
    startTransition(() => patchCommitmentAction(state.completionEventId as string, { note: note.trim() }));
  };

  const handleUndo = () => {
    if (!state.completionEventId) return;
    startTransition(async () => {
      await voidCommitmentAction(state.completionEventId as string);
      setState((s) => ({ ...s, completionEventId: null, resistance: null }));
      setShowNote(false);
    });
  };

  return (
    <div className="border-b border-border py-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-sans text-ink text-base">{state.label}</span>
        {!state.completionEventId ? (
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="ia border border-accent-dim px-3 py-1.5 font-mono text-xs uppercase tracking-wide2 text-accent"
          >
            Complete
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <SystemVoice size="sm" className="text-ink-faint">
              Done
            </SystemVoice>
            <button
              type="button"
              onClick={handleUndo}
              disabled={isPending}
              className="ia-link font-mono text-xs uppercase tracking-wide2"
            >
              Undo
            </button>
          </div>
        )}
      </div>

      {state.completionEventId && !state.resistance && (
        <div className="mt-3 flex gap-2">
          {RESISTANCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleResistance(option.value)}
              disabled={isPending}
              className="ia border border-border px-2 py-1 font-mono text-xs uppercase tracking-wide2 text-ink-muted"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {state.completionEventId && state.resistance && !showNote && (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="ia-link text-ink-faint mt-2 font-mono text-xs uppercase tracking-wide2"
        >
          + Note
        </button>
      )}

      {state.completionEventId && showNote && (
        <input
          type="text"
          autoFocus
          onBlur={(e) => handleNote(e.currentTarget.value)}
          placeholder="One line."
          className="ia mt-2 w-full border-b border-border bg-transparent font-sans text-ink text-sm"
        />
      )}
    </div>
  );
}
