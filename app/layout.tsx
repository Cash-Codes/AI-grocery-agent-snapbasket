import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnapBasket — durable AI grocery agent",
  description:
    "An exploration of durable orchestration for agentic AI: upload a grocery photo, get a basket, approve before checkout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
