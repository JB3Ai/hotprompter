import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOTPROMPTER Dashboard",
  description: "Local-only prompt, engine, and gallery dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
