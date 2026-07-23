import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { type Language, defaultLanguage } from "@/i18n";
import AdminShortcut from "@/components/AdminShortcut";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CHILLERS",
    template: "%s · CHILLERS",
  },
  description: "Streaming de films et séries en VF/VOSTFR.",
  applicationName: "CHILLERS",
  openGraph: {
    type: "website",
    siteName: "CHILLERS",
    title: "CHILLERS",
    description: "Streaming de films et séries en VF/VOSTFR.",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512, alt: "CHILLERS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CHILLERS",
    description: "Streaming de films et séries en VF/VOSTFR.",
    images: ["/android-chrome-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

// P2-#30: resolve the language from the cookie on the server so the first
// paint already has the right translations. Middleware guarantees the cookie
// exists, so this is just a typed read. In Next 16 `cookies()` is async.
async function resolveInitialLang(): Promise<Language> {
  try {
    const store = await cookies();
    const c = store.get("chillers-lang")?.value;
    if (c === "fr" || c === "en") return c;
  } catch {
    /* cookies() throws in some server contexts; fall through to default */
  }
  return defaultLanguage;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLang = await resolveInitialLang();
  return (
    <html
      lang={initialLang}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-screen flex flex-col bg-brand-dark text-foreground selection:bg-brand-primary selection:text-white">
        <LanguageProvider initialLang={initialLang}>
          <AdminShortcut />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
