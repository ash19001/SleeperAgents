import type { Metadata, Viewport } from "next";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";

// One statement face for everything, with tabular figures for the money.
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });

export const metadata: Metadata = {
  title: "Why My Bill",
  description: "Ask why a household energy or water bill changed and see the £ split, the causes and the evidence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#13224a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${franklin.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
