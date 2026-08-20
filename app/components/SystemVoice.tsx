import type { ReactNode } from "react";

/**
 * The system's own voice — the report, rank, momentum state
 * (milestone-4-spec.md §2): monospace, uppercase, wide letter-spacing. Use
 * for anything the system states as fact; never for what the user typed
 * (that stays in the humanist sans, at its own casing).
 */
export function SystemVoice({
  as: Component = "span",
  size = "base",
  children,
  className = "",
}: {
  as?: "span" | "div" | "h1" | "h2" | "p";
  size?: "sm" | "base" | "lg";
  children: ReactNode;
  className?: string;
}) {
  const sizeClass = size === "sm" ? "text-xs tracking-wide2" : size === "lg" ? "text-lg tracking-wide2" : "text-sm tracking-wide3";
  return (
    <Component className={`font-mono uppercase ${sizeClass} ${className}`}>{children}</Component>
  );
}
