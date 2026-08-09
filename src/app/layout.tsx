import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const serif = IBM_Plex_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Reactivation Desk · Rowan case",
  description:
    "Prioritize dormant advisor prospects from exports — ranked outreach with evidence, human action, durable outcomes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body
        className={`${sans.className} min-h-full antialiased`}
        style={{ fontFamily: "var(--font-sans), IBM Plex Sans, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
