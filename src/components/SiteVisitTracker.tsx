"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_KEY = "chillers-visitor-v1";
const SESSION_KEY = "chillers-visit-session-v1";
const CAMPAIGN_KEY = "chillers-visit-campaign-v1";
const VISITOR_TTL = 30 * 24 * 60 * 60 * 1000;
const SESSION_IDLE = 30 * 60 * 1000;
const CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

function uuid(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function readCampaign(sessionId: string): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "{}");
    const fresh = new URLSearchParams(window.location.search);
    const campaign = {
      sessionId,
      source: fresh.get("utm_source") || (saved.sessionId === sessionId ? saved.source : "") || "direct",
      medium: fresh.get("utm_medium") || (saved.sessionId === sessionId ? saved.medium : ""),
      campaign: fresh.get("utm_campaign") || (saved.sessionId === sessionId ? saved.campaign : ""),
    };
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
    return campaign;
  } catch {
    return { source: "direct", medium: "", campaign: "" };
  }
}

export default function SiteVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const now = Date.now();
    let visitor: { id: string; expiresAt: number } | null = null;
    try {
      visitor = JSON.parse(localStorage.getItem(VISITOR_KEY) || "null");
    } catch {}
    if (!visitor?.id || visitor.expiresAt <= now) {
      visitor = { id: uuid(), expiresAt: now + VISITOR_TTL };
      try { localStorage.setItem(VISITOR_KEY, JSON.stringify(visitor)); } catch {}
    }

    let session: { id: string; lastActivityAt: number } | null = null;
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch {}
    if (!session?.id || now - session.lastActivityAt > SESSION_IDLE) {
      session = { id: uuid(), lastActivityAt: now };
    } else {
      session.lastActivityAt = now;
    }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}

    const campaign = readCampaign(session.id);
    void fetch(`/api/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: visitor.id,
        sessionId: session.id,
        pagePath: pathname,
        ...campaign,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
