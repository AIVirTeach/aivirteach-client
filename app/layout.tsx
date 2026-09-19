import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
    title: { default: "AIVirTeach", template: "%s | AIVirTeach" },
    description: "Learn by doing in an interactive workspace with personalised AI guidance.",
    icons: { icon: [{ url: "/favicon.png?v=2", type: "image/png" }] },
    openGraph: {
      title: "AIVirTeach",
      description: "Turn AI learners into AI builders.",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "AIVirTeach",
      description: "Turn AI learners into AI builders.",
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
