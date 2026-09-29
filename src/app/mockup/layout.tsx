import type { Metadata } from "next";
import { MockRoot } from "./_components/MockShell";

export const metadata: Metadata = {
  title: "NEF Notizen – UI-Mockup",
  robots: { index: false, follow: false },
};

export default function MockupLayout({ children }: { children: React.ReactNode }) {
  return <MockRoot>{children}</MockRoot>;
}
