"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Long user-written text (Outcomes, Marks, Notes, quest statements) shows
 * the first few lines, with a Read more toggle only when it is actually cut
 * off. Short text renders untouched.
 */
export function ClampText({ children, className = "" }: { children: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [children, expanded]);

  return (
    <div>
      <p ref={ref} className={`${className} ${expanded ? "" : "line-clamp-3"}`}>
        {children}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ia-link text-ink-faint mt-1 font-mono text-xs uppercase tracking-wide2"
        >
          {expanded ? "Less" : "Read more"}
        </button>
      )}
    </div>
  );
}
