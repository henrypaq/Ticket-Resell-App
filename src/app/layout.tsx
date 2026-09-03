import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font — no runtime request to Google. Scoped to
// headlines only (the .headline utility in globals.css); everything else
// stays on the system sans stack — see STYLE.md § typography.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Passe · Montreal tickets",
  description:
    "Resell and pick up tickets to parties and club nights around Montreal — at face value, with the full price breakdown up front.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Passe" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-dvh bg-base text-ink antialiased">{children}</body>
    </html>
  );
}
