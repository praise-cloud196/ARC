import type { Config } from "tailwindcss";

// Design language (milestone-4-spec.md §2): dark, near-black ground with a
// cool cast; one accent colour used sparingly; monospace/uppercase for the
// system's own voice, humanist sans for what the user enters. No red
// anywhere in this product — there is deliberately no "danger"/"error"
// color token here at all, so one can't get introduced by habit later.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#0b0e14",
        surface: "#12161f",
        border: "rgba(230, 233, 240, 0.08)",
        ink: {
          DEFAULT: "rgba(230, 233, 240, 0.92)",
          muted: "rgba(230, 233, 240, 0.58)",
          faint: "rgba(230, 233, 240, 0.34)",
        },
        accent: {
          DEFAULT: "#c2a26b",
          dim: "rgba(194, 162, 107, 0.55)",
          faint: "rgba(194, 162, 107, 0.16)",
        },
      },
      fontFamily: {
        // System voice — the report, rank, momentum state — uppercase,
        // wide letter-spacing wherever it's used (utility class, not baked
        // in here, since not every mono use is uppercase).
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        // What the user enters — notes, statements, labels.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wide2: "0.08em",
        wide3: "0.14em",
      },
    },
  },
  plugins: [],
};

export default config;
