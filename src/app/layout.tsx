import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Why My Bill",
  description: "Ask why a household energy or water bill changed and see the £ split, the causes and the evidence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${sourceSans.variable} ${plexMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
