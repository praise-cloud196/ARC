import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

// milestone-4-spec.md §2: "type carries the identity" — a technical
// monospace for the system's own voice (uppercase, wide tracking wherever
// it's used) versus a humanist sans for what the user enters. Both
// self-hosted by next/font at build time — no runtime request to Google.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARC",
  description: "A permanent record of who you are becoming.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ARC",
  },
};

// Installable PWA (milestone-4-spec.md §7), zero notifications: this file
// declares installability metadata only. No push permission is ever
// requested anywhere in this product.
export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${plexMono.variable}`}>
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
