import type { Metadata, Viewport } from "next";
import { Archivo, Bodoni_Moda } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/server/auth/session";

import "./globals.css";

/**
 * A high-contrast fashion serif for display, a neutral grotesk for everything
 * with a job to do. Both are variable fonts, self-hosted by next/font, so there
 * is no render-blocking request to a third party and no flash of fallback text.
 */
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  weight: ["400", "500", "600"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Almirah — the wardrobe, shared",
    // Every page appends its own name; the brand stays put.
    template: "%s · Almirah",
  },
  description:
    "Rent pieces from real wardrobes for the occasions that ask for something, and send them back when the night is over. Sarees, lehengas, tailoring and evening wear across India.",
  applicationName: "Almirah",
  keywords: [
    "clothing rental",
    "rent lehenga",
    "rent saree",
    "wedding guest outfit",
    "designer rental India",
    "peer to peer fashion rental",
  ],
  authors: [{ name: "Almirah" }],
  openGraph: {
    type: "website",
    siteName: "Almirah",
    title: "Almirah — the wardrobe, shared",
    description:
      "Rent pieces from real wardrobes for the occasions that ask for something. Own less, wear more.",
    url: APP_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Almirah — the wardrobe, shared",
    description: "Rent pieces from real wardrobes for the occasions that ask for something.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ee",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved once here and passed down, rather than each header component
  // reaching for the session independently.
  const user = await getCurrentUser();

  return (
    <html lang="en-IN" className={`${bodoni.variable} ${archivo.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader user={user} />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
