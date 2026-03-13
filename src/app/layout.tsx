import type { Metadata } from "next";
import { Lora, Nunito, Caveat, Playfair_Display, Oswald, Dancing_Script } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import AccessGate from "@/components/AccessGate";
import "./globals.css";

const lora = Lora({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-classic",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const oswald = Oswald({
  variable: "--font-bold",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dancingScript = Dancing_Script({
  variable: "--font-brush",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nuuge — Cards that sound like you",
  description:
    "AI-powered personal cards created from context about you and the people you care about.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${nunito.variable} ${caveat.variable} ${playfairDisplay.variable} ${oswald.variable} ${dancingScript.variable} antialiased`}>
        <AccessGate>{children}</AccessGate>
        <Analytics />
      </body>
    </html>
  );
}
