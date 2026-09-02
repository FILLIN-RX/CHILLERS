import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { type Language, defaultLanguage } from "@/i18n";
import AdminShortcut from "@/components/AdminShortcut";
import PWARegister from "@/components/pwa/PWARegister";
import SplashScreen from "@/components/pwa/SplashScreen";
import PWAInstallBanner from "@/components/pwa/PWAInstallBanner";
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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app").replace(/\/$/, "");

const defaultOgImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "CHILLERS — Films et séries en streaming gratuit",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CHILLERS",
    template: "%s · CHILLERS",
  },
  description:
    "Regardez vos films, séries et anime préférés en streaming gratuit et illimité sur CHILLERS, en VF et VOSTFR.",
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
    title: "CHILLERS — Films et séries en streaming gratuit",
    description:
      "Regardez vos films, séries et anime préférés en streaming gratuit et illimité sur CHILLERS, en VF et VOSTFR.",
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    site: "@chillers",
    creator: "@chillers",
    title: "CHILLERS — Films et séries en streaming gratuit",
    description:
      "Regardez vos films, séries et anime préférés en streaming gratuit et illimité sur CHILLERS, en VF et VOSTFR.",
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
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
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
  return (
    <html
      lang={initialLang}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <head>
        {/*
          Splash natif : injecté AVANT React pour s'afficher immédiatement au lancement de la PWA.
          Le composant React SplashScreen.tsx gère ensuite la disparition animée.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          #__chillers_splash {
            position:fixed;inset:0;z-index:99999;
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            background:#09090b;
            pointer-events:none;
          }
          #__chillers_splash img {
            width:96px;height:96px;
            filter:drop-shadow(0 0 28px rgba(215,4,102,0.6));
            animation:__csp 2s ease-in-out infinite;
          }
          #__chillers_splash h1 {
            margin:20px 0 32px;
            font-size:28px;font-weight:900;
            letter-spacing:.18em;text-transform:uppercase;
            background:linear-gradient(135deg,#d70466,#7c3aed);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;
            background-clip:text;
          }
          #__chillers_splash .bar-track {
            width:120px;height:3px;
            background:rgba(255,255,255,.1);
            border-radius:99px;overflow:hidden;
          }
          #__chillers_splash .bar-fill {
            height:100%;
            background:linear-gradient(90deg,#d70466,#7c3aed);
            border-radius:99px;
            animation:__clb 1.8s ease-in-out infinite;
          }
          @keyframes __csp {
            0%,100%{transform:scale(1);filter:drop-shadow(0 0 28px rgba(215,4,102,.55));}
            50%{transform:scale(1.07);filter:drop-shadow(0 0 44px rgba(215,4,102,.9));}
          }
          @keyframes __clb {
            0%{width:0%;margin-left:0%}
            50%{width:75%;margin-left:12%}
            100%{width:0%;margin-left:100%}
          }
        `}} />
      </head>
      <body suppressHydrationWarning className="min-h-screen flex flex-col bg-brand-dark text-foreground selection:bg-brand-primary selection:text-white">
        {/* Splash pré-React — retiré par SplashScreen.tsx une fois les données chargées */}
        <div id="__chillers_splash" aria-hidden="true" suppressHydrationWarning>
          <img src="/android-chrome-192x192.png" alt="" />
          <h1>CHILLERS</h1>
          <div className="bar-track"><div className="bar-fill" /></div>
        </div>
        <LanguageProvider initialLang={initialLang}>
          <PWARegister />
          <SplashScreen />
          <PWAInstallBanner />
          <AdminShortcut />
          {children}
        </LanguageProvider>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8325042872748312"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
