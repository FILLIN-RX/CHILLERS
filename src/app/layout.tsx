import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins, Bungee_Shade } from "next/font/google";
import Script from "next/script";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { defaultLanguage } from "@/i18n";
import AdminShortcut from "@/components/AdminShortcut";
import LiquidGlassFilter from "@/components/ui/LiquidGlassFilter";
import PWARegister from "@/components/pwa/PWARegister";
import SplashScreen from "@/components/pwa/SplashScreen";
// import PWAInstallBanner from "@/components/pwa/PWAInstallBanner"; // Désactivé - banner pas désiré
import NetworkStatusNotifier from "@/components/pwa/NetworkStatusNotifier";
import { SITE_URL } from "@/lib/seo";

import AdSense from "@/components/AdSense";
import SessionSyncProvider from "@/components/providers/SessionSyncProvider";
import QueryProvider from "@/components/QueryProvider";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import CookieNotice from "@/components/CookieNotice";
import SiteVisitTracker from "@/components/SiteVisitTracker";
import ChristmasEffects from "@/components/christmas/ChristmasEffects";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const bungeeShade = Bungee_Shade({ variable: "--font-bungee-shade", subsets: ["latin"], weight: ["400"], display: "swap", preload: false });

const siteUrl = SITE_URL;

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
  themeColor: "#1F1F1F",
};

// P3: ce layout est volontairement SANS API dynamique (cookies()/auth()) :
// c'est la condition pour que les pages publiques (/, /categories…) soient
// prérédigées à build time et servies en ISR. La langue est résolue côté
// client (localStorage/cookie/navigator) par LanguageProvider, et la session
// NextAuth est chargée côté client par SessionProvider.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={defaultLanguage}
      className={`${geistMono.variable} ${poppins.variable} ${bungeeShade.variable} dark h-full antialiased`}
    >
      <head>
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WSB9KSPX');`,
          }}
        />
        {/*
          Splash natif : injecté AVANT React pour s'afficher immédiatement au lancement de la PWA/Web.
          Le composant React SplashScreen.tsx gère ensuite la disparition animée.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          #__chillers_splash {
            position:fixed;inset:0;z-index:99999;
            display:flex;align-items:center;justify-content:center;
            background:#1F1F1F;
            pointer-events:none;
          }
          #__chillers_splash .splash-spinner {
            position:relative;
            width:40px;height:40px;
          }
          #__chillers_splash .splash-spinner span {
            position:absolute;
            left:18.25px;top:0;
            width:3.5px;height:10px;
            border-radius:2px;
            background:var(--color-brand-primary,#F42A7C);
            transform-origin:1.75px 20px;
            opacity:0.15;
            animation:__apple-fade 1s linear infinite;
            will-change:opacity;
          }
          @keyframes __apple-fade {
            0% { opacity:1; }
            100% { opacity:0.15; }
          }
          @media (prefers-reduced-motion: reduce) {
            #__chillers_splash .splash-spinner span { animation: none; opacity: 0.35; }
            #__chillers_splash .splash-spinner span:nth-child(1),
            #__chillers_splash .splash-spinner span:nth-child(4),
            #__chillers_splash .splash-spinner span:nth-child(7),
            #__chillers_splash .splash-spinner span:nth-child(10) { opacity: 0.9; }
          }
          #__chillers_splash .splash-spinner span:nth-child(1)  { transform:rotate(0deg);   animation-delay:-0.9167s; }
          #__chillers_splash .splash-spinner span:nth-child(2)  { transform:rotate(30deg);  animation-delay:-0.8333s; }
          #__chillers_splash .splash-spinner span:nth-child(3)  { transform:rotate(60deg);  animation-delay:-0.75s; }
          #__chillers_splash .splash-spinner span:nth-child(4)  { transform:rotate(90deg);  animation-delay:-0.6667s; }
          #__chillers_splash .splash-spinner span:nth-child(5)  { transform:rotate(120deg); animation-delay:-0.5833s; }
          #__chillers_splash .splash-spinner span:nth-child(6)  { transform:rotate(150deg); animation-delay:-0.5s; }
          #__chillers_splash .splash-spinner span:nth-child(7)  { transform:rotate(180deg); animation-delay:-0.4167s; }
          #__chillers_splash .splash-spinner span:nth-child(8)  { transform:rotate(210deg); animation-delay:-0.3333s; }
          #__chillers_splash .splash-spinner span:nth-child(9)  { transform:rotate(240deg); animation-delay:-0.25s; }
          #__chillers_splash .splash-spinner span:nth-child(10) { transform:rotate(270deg); animation-delay:-0.1667s; }
          #__chillers_splash .splash-spinner span:nth-child(11) { transform:rotate(300deg); animation-delay:-0.0833s; }
          #__chillers_splash .splash-spinner span:nth-child(12) { transform:rotate(330deg); animation-delay:0s; }
        `}} />
      </head>
      <body suppressHydrationWarning className="min-h-screen flex flex-col pt-safe bg-brand-dark text-foreground selection:bg-brand-primary selection:text-white">
        {/* Google Tag Manager (noscript fallback) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WSB9KSPX"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <LiquidGlassFilter />
        <GoogleAnalytics />
        <SiteVisitTracker />
        <CookieNotice />
          {/* Splash pré-React — retiré par SplashScreen.tsx une fois les données chargées */}
        {/* dangerouslySetInnerHTML : React ne touche JAMAIS aux enfants → zéro erreur insertBefore/removeChild */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `<div id="__chillers_splash" aria-hidden="true"><div class="splash-spinner"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><script>setTimeout(function(){var s=document.getElementById("__chillers_splash");if(s){s.style.transition="opacity 0.4s ease";s.style.opacity="0";setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},400);}},3500);</script></div>`,
          }}
        />
        <SessionSyncProvider>
          <QueryProvider>
            <LanguageProvider>
              <PWARegister />
              <SplashScreen />
              <ChristmasEffects snowMode="live" garland />
              {/* <PWAInstallBanner /> - Désactivé */}
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
