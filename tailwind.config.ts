import type { Config } from "tailwindcss";

// Design language (docs/design-revision-v1.md §2, superseding
// milestone-4-spec.md §2's palette): dark, near-black ground with a cool
// cast; one accent colour used sparingly — cool steel blue, not gold, so it
// reads as *system* rather than *achievement badge*; monospace/uppercase
// for the system's own voice, humanist sans for what the user enters. No
// red anywhere in this product — there is deliberately no "danger"/"error"
// color token here at all, so one can't get introduced by habit later.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#0A0C10",
        surface: "#0E1117",
        panel: "#0E1117",
        border: "#1C2230",
        ink: {
          DEFAULT: "#E6E9EF",
          muted: "rgba(230, 233, 239, 0.6)",
          faint: "#7A828F",
        },
        accent: {
          DEFAULT: "#6C9DC6",
          bright: "#8FD3E8",
          dim: "rgba(108, 157, 198, 0.55)",
          faint: "rgba(108, 157, 198, 0.16)",
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
