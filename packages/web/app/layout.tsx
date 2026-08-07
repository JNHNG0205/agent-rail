import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/// Three faces, each with a job. Member 4.
///
/// Inter did all three and said nothing about any of them. What replaced it is
/// chosen for what this application actually shows.
///
/// Bricolage Grotesque carries headings and figures. It has real character at
/// large sizes — tight apertures, a slightly mechanical skeleton — which suits a
/// system of rails and registers without dressing it up as a bank.
///
/// Public Sans sets the prose. It was drawn for public records: legible small,
/// neutral under dense text, and never competing with the display face.
///
/// IBM Plex Mono takes every address, hash and amount. Those are the numbers a
/// person checks against another screen, so they need unambiguous digits and
/// columns that line up — a proportional face makes 0x8 and 0xB a guess.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentRail — AI Agent Payment Settlement Layer",
  description:
    "AgentRail is an on-chain settlement layer for autonomous AI agents, powering ERC-8004 identity and ERC-8183 job escrow with USDC.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0a2e2b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`bg-background ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
