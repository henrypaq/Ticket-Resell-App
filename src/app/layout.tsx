import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
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
  title: "mcgill.tickets · Montreal tickets",
  description:
    "Resell and pick up tickets to parties and club nights around Montreal — at face value, with the full price breakdown up front.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "mcgill.tickets" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
      <body className="min-h-dvh bg-base text-ink antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
