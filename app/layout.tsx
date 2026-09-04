import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Actnivo — Your commerce operations, running themselves",
    description: "Actnivo connects every commerce channel, finds what is costing you money and executes the fix.",
    openGraph: {
      title: "Actnivo — Your commerce operations, running themselves",
      description: "Detect problems, protect revenue and execute the fix.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Actnivo AI commerce operations" }],
    },
    twitter: { card: "summary_large_image", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
