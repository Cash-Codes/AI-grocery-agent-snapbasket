import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { DemoBanner } from "@/components/DemoBanner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnapBasket - durable AI grocery agent",
  description:
    "An exploration of durable orchestration for agentic AI: upload a grocery photo, get a basket, approve before checkout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground relative flex min-h-full flex-col font-sans">
        <DemoBanner />
        <div className="bg-mesh pointer-events-none fixed inset-0 -z-10" />
        <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-50" />
        {children}
      </body>
    </html>
  );
}
