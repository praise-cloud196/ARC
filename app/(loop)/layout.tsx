import { Nav } from "@/app/components/Nav";

/**
 * Shared by Today, the character sheet, and commitments — the three
 * screens the persistent Nav connects. /audit and /login sit outside this
 * route group (siblings under app/) and don't get it: they're their own
 * separate flows, not part of the Loop.
 *
 * pb-16 on the wrapper reserves room for the fixed Nav so it never
 * overlaps a screen's own last line of content.
 */
export default function LoopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-16">
      {children}
      <Nav />
    </div>
  );
}
