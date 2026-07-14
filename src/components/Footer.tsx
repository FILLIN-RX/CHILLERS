"use client";

import React from "react";

export default function Footer() {
  return (
    <footer className="w-full bg-brand-dark border-t border-brand-border mt-auto transition-colors duration-300">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 md:px-12 lg:px-[4%] py-12 space-y-12">
        
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <h3 className="text-xl font-black tracking-wider text-foreground">
              CHILL<span className="text-brand-primary">ER</span>
            </h3>
            <p className="text-xs text-brand-text-muted font-light leading-relaxed max-w-xs">
              Chiller is a luxury streaming ecosystem providing instant access to award-winning cinema, exclusive series, documentaries, and global anime blockbusters.
            </p>
          </div>

          {/* Categories Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Categories</h4>
            <ul className="space-y-2 text-xs text-brand-text-muted font-medium">
              <li><a href="#" className="hover:text-brand-primary transition-colors">Action & Adventure</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Sci-Fi & Cyberpunk</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Anime Blockbusters</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Cultural Documentaries</a></li>
            </ul>
          </div>

          {/* Editorial & Collections Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Editorial</h4>
            <ul className="space-y-2 text-xs text-brand-text-muted font-medium">
              <li><a href="#" className="hover:text-brand-primary transition-colors">African Cinema (Canal+ Style)</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Trending Worldwide</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">New Releases This Week</a></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Top Rated Masterpieces</a></li>
            </ul>
          </div>

          {/* Socials & Newsletter Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-foreground">Join the Chill</h4>
            <p className="text-xs text-brand-text-muted font-light">
              Follow us on social channels to keep up with premier releases.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all">
                𝕏
              </a>
              <a href="#" className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all">
                f
              </a>
              <a href="#" className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all">
                📷
              </a>
              <a href="#" className="h-8 w-8 rounded-full bg-brand-card border border-brand-border hover:border-brand-primary flex items-center justify-center text-brand-text-muted hover:text-brand-primary transition-all">
                ▶
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Rights & Policy Row */}
        <div className="border-t border-brand-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-brand-text-muted/80 font-semibold">
          <span>&copy; {new Date().getFullYear()} Chiller Inc. No rights reserved. v1.1.2</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-brand-primary transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-brand-primary transition-colors">Cookie settings</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
