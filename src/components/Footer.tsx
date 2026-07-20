"use client";

import React from "react";
import Link from "next/link";
import { HeartIcon, CameraIcon, InformationCircleIcon, EnvelopeIcon, ShieldCheckIcon, PlayIcon } from "@heroicons/react/24/solid";

export default function Footer() {
  return (
    <footer className="w-full bg-brand-dark border-t border-brand-border mt-auto transition-colors duration-300">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 md:px-12 lg:px-[4%] py-12 space-y-12">
        
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-wider text-foreground">
              CHILL<span className="text-brand-primary">ERS</span>
            </h2>
            <p className="text-xs text-brand-text-muted font-light leading-relaxed max-w-xs">
              L{"'"}expérience ultime du streaming gratuit. Films, séries, anime — accès instantané, zéro pub.
            </p>
            <p className="text-[10px] text-zinc-500 font-medium italic leading-relaxed">
              Chillers ne stocke aucun fichier. Tout contenu est hébergé par des tiers non affiliés. À des fins éducatives uniquement.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Liens</h3>
            <ul className="space-y-2 text-xs text-brand-text-muted font-medium">
              <li>
                <Link href="/about" className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <InformationCircleIcon className="h-3.5 w-3.5" />
                  À Propos
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/support" className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <HeartIcon className="h-3.5 w-3.5" />
                  Soutenir
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="flex items-center gap-2 hover:text-brand-primary transition-colors">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Politique de confidentialité
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories Links — point to the /categories page with a query for
              the specific genre so the destination isn't a dead-end. */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Categories</h3>
            <ul className="space-y-2 text-xs text-brand-text-muted font-medium">
              <li>
                <Link
                  href={{ pathname: "/categories", query: { genre: "Action & Adventure" } }}
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                >
                  <PlayIcon className="h-3.5 w-3.5" />
                  Action &amp; Adventure
                </Link>
              </li>
              <li>
                <Link
                  href={{ pathname: "/categories", query: { genre: "Sci-Fi & Cyberpunk" } }}
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                >
                  <PlayIcon className="h-3.5 w-3.5" />
                  Sci-Fi &amp; Cyberpunk
                </Link>
              </li>
              <li>
                <Link
                  href={{ pathname: "/categories", query: { genre: "Anime" } }}
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                >
                  <PlayIcon className="h-3.5 w-3.5" />
                  Anime Blockbusters
                </Link>
              </li>
              <li>
                <Link
                  href={{ pathname: "/categories", query: { genre: "Documentary" } }}
                  className="flex items-center gap-2 hover:text-brand-primary transition-colors"
                >
                  <PlayIcon className="h-3.5 w-3.5" />
                  Cultural Documentaries
                </Link>
              </li>
            </ul>
          </div>

          {/* Support / Donate */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Soutenir</h3>
            <p className="text-xs text-brand-text-muted font-light">
              Le projet vit grâce à vos dons. Orange Money &amp; Mobile Money acceptés.
            </p>
            <Link
              href="/support"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/30"
            >
              <HeartIcon className="h-4 w-4" />
              Nous soutenir
            </Link>
          </div>

          {/* Socials & Newsletter Info — these don't have real URLs yet, so use
              <button type="button"> that no-ops cleanly instead of <a href="#">. */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Join the Chill</h3>
            <p className="text-xs text-brand-text-muted font-light">
              Follow us on social channels to keep up with premier releases.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                aria-label="X (Twitter)"
                className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all"
              >
                𝕏
              </button>
              <button
                type="button"
                aria-label="Facebook"
                className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all"
              >
                f
              </button>
              <button
                type="button"
                aria-label="Instagram"
                className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all"
              >
                <CameraIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="YouTube"
                className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all"
              >
                ▶
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Rights & Policy Row */}
        <div className="border-t border-brand-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-brand-text-muted/80 font-semibold">
          <span>&copy; {new Date().getFullYear()} Chillers. No rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/about" className="flex items-center gap-1.5 hover:text-brand-primary transition-colors">
              <InformationCircleIcon className="h-3 w-3" />
              À Propos
            </Link>
            <span>•</span>
            <Link href="/contact" className="flex items-center gap-1.5 hover:text-brand-primary transition-colors">
              <EnvelopeIcon className="h-3 w-3" />
              Contact
            </Link>
            <span>•</span>
            <Link href="/privacy" className="flex items-center gap-1.5 hover:text-brand-primary transition-colors">
              <ShieldCheckIcon className="h-3 w-3" />
              Confidentialité
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
