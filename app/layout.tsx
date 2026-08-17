import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARC",
  description: "A permanent record of who you are becoming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
