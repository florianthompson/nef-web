import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "NEF Protokoll — Digitale Schichtübergabe für Rettungsdienste",
  description:
    "Das digitale Übergabeprotokoll für Rettungsdienste. Fahrzeuge, Medikamente und Ausrüstung — alles geprüft, dokumentiert und in Echtzeit synchronisiert.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={cn(dmSans.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
