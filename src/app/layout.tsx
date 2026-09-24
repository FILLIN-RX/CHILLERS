import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { type Language, defaultLanguage } from "@/i18n";
import AdminShortcut from "@/components/AdminShortcut";
import PWARegister from "@/components/pwa/PWARegister";
import SplashScreen from "@/components/pwa/SplashScreen";
import PWAInstallBanner from "@/components/pwa/PWAInstallBanner";
import NetworkStatusNotifier from "@/components/pwa/NetworkStatusNotifier";

import AdSense from "@/components/AdSense";
import SessionSyncProvider from "@/components/providers/SessionSyncProvider";
import QueryProvider from "@/components/QueryProvider";
import { auth } from "@/auth";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.site").replace(/\/$/, "");

const defaultOgImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "CHILLERS — Films, Séries & Matchs de Foot en Streaming HD Gratuit",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CHILLERS — Films, Séries, Anime & Foot en Direct HD Gratuit",
    template: "%s · CHILLERS",
  },
  description:
    "Regardez vos films, séries, anime et matchs de football en direct streaming HD gratuit sans pub sur CHILLERS en VF et VOSTFR.",
  applicationName: "CHILLERS",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  keywords: [
    "streaming",
    "films gratuit",
    "séries streaming",
    "anime streaming",
    "match en direct",
    "football streaming",
    "ligue des champions direct",
    "VF",
    "VOSTFR",
    "CHILLERS",
  ],
  category: "Entertainment",
  openGraph: {
    type: "website",
    siteName: "CHILLERS",
    locale: "fr_FR",
    url: siteUrl,
    title: "CHILLERS — Films, Séries & Foot en Direct Streaming HD Gratuit",
    description:
      "Regardez vos films, séries, anime et matchs de football en streaming HD gratuit et illimité sur CHILLERS.",
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    site: "@chillers",
    creator: "@chillers",
    title: "CHILLERS — Films, Séries & Foot en Direct Streaming HD Gratuit",
    description:
      "Regardez vos films, séries, anime et matchs de football en streaming HD gratuit et illimité sur CHILLERS.",
    images: [defaultOgImage],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/android-chrome-192x192.png"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CHILLERS",
  },
  verification: {
    google: "google64be53e2bb2faf7b",
  },
  manifest: "/site.webmanifest",
};

// viewport-fit=cover: nécessaire pour que les safe-area-inset (encoche iPhone,
// barre gestuelle) utilisés par `.pb-safe` s'appliquent réellement.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
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
  const session = await auth().catch(() => null);
  return (
    <html
      lang={initialLang}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        {/*
          Splash natif : injecté AVANT React pour s'afficher immédiatement au lancement de la PWA/Web.
          Le composant React SplashScreen.tsx gère ensuite la disparition animée.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          #__chillers_splash {
            position:fixed;inset:0;z-index:99999;
            display:flex;align-items:center;justify-content:center;
            background:#09090b;
            pointer-events:none;
          }
          #__chillers_splash .splash-spinner {
            width:72px;height:72px;
            border-radius:50%;
            border:4px solid rgba(255,255,255,0.08);
            border-top-color:#f42a7c;
            animation:__spin 0.85s linear infinite;
            box-sizing:border-box;
          }
          @keyframes __spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </head>
      <body suppressHydrationWarning className="min-h-screen flex flex-col bg-brand-dark text-foreground selection:bg-brand-primary selection:text-white">
        {/* Google Tag (gtag.js) avec Consent Mode */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-07EF63R64Y"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              
              // Configuration par défaut du Mode Consentement (EEE)
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'analytics_storage': 'denied'
              });
              
              gtag('js', new Date());
              gtag('config', 'G-07EF63R64Y');
            `,
          }}
        />
        {/* Splash pré-React — retiré par SplashScreen.tsx une fois les données chargées */}
        {/* dangerouslySetInnerHTML : React ne touche JAMAIS aux enfants → zéro erreur insertBefore/removeChild */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `<div id="__chillers_splash" aria-hidden="true"><div class="splash-spinner"></div><script>setTimeout(function(){var s=document.getElementById("__chillers_splash");if(s){s.style.transition="opacity 0.4s ease";s.style.opacity="0";setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},400);}},3500);</script></div>`,
          }}
        />
        <SessionSyncProvider session={session}>
          <QueryProvider>
            <LanguageProvider initialLang={initialLang}>
              <PWARegister />
              <SplashScreen />
              <PWAInstallBanner />
              <NetworkStatusNotifier />
              <AdminShortcut />
              <AdSense />
              {children}
            </LanguageProvider>
          </QueryProvider>
        </SessionSyncProvider>
      </body>
    </html>
  );
}
