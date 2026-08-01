import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: { default: "Cognitive Flow", template: "%s | Cognitive Flow" },
    description: "Learn by doing in an interactive workspace with personalised AI guidance.",
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: "Cognitive Flow",
      description: "Learn by doing, with AI beside you.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Cognitive Flow learning workspace" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cognitive Flow",
      description: "Learn by doing, with AI beside you.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
