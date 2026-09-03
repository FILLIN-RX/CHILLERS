"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  IconCrown,
  IconLogout,
} from "@tabler/icons-react";
import UserAvatar from "@/components/UserAvatar";

export interface ProfileTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  description?: string;
}

interface ProfileSidebarProps {
  user: any;
  tabs: ProfileTabItem[];
  activeTab: string;
  lang: string;
  onLogout: () => void;
}

export default function ProfileSidebar({
  user,
  tabs,
  activeTab,
  lang,
  onLogout,
}: ProfileSidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0">
      {/* Fixed container on desktop: stays anchored at left below the navbar */}
      <div className="lg:fixed lg:top-24 lg:left-6 xl:left-10 lg:w-72 xl:w-80 lg:bottom-6 lg:overflow-y-auto no-scrollbar space-y-6 z-20 pr-2">
        {/* User Profile Card */}
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" showBadge={true} />
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                {user.username || user.email.split("@")[0]}
              </h2>
              <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    user.subscription?.plan === "premium"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : user.subscription?.plan === "standard"
                        ? "bg-blue-500/20 text-cyan-300 border-blue-500/30"
                        : "bg-white/10 text-zinc-300 border-white/5"
                  }`}
                >
                  {user.subscription?.plan === "premium" && (
                    <IconCrown className="w-3 h-3 text-yellow-400" />
                  )}
                  {user.subscription?.plan === "standard" && (
                    <IconCrown className="w-3 h-3 text-cyan-400" />
                  )}
                  {user.role === "admin"
                    ? "Admin VIP"
                    : user.subscription?.plan || "Free"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (YouTube style) */}
        <nav className="flex flex-col gap-1.5 bg-zinc-900/40 border border-white/5 p-2 rounded-3xl">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => router.push(`/profile?tab=${t.id}`)}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all outline-none group cursor-pointer ${
                  active
                    ? "bg-[#D70466] text-white shadow-lg shadow-[#D70466]/20 font-black"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                      active ? "text-white" : "text-zinc-400 group-hover:text-white"
                    }`}
                  />
                  <span className="truncate">{t.label}</span>
                </div>
                {t.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-zinc-300 group-hover:bg-white/20"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="pt-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-start gap-3 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
          >
            <IconLogout className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{lang === "fr" ? "Se déconnecter" : "Log Out"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
