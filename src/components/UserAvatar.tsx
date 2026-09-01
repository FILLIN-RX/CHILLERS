"use client";

import * as React from "react";
import { IconCrown, IconBolt, IconUser } from "@tabler/icons-react";

export type PlanType = "free" | "standard" | "premium" | string;

interface UserAvatarProps {
  user?: {
    username?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    subscription?: {
      plan?: PlanType;
      status?: string;
    };
  } | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
}

const sizeConfig = {
  xs: {
    container: "w-5 h-5 text-[10px]",
    ring: "p-[1px]",
    badge: "w-2.5 h-2.5 -bottom-0.5 -right-0.5 p-[1px]",
    badgeIcon: "w-1.5 h-1.5",
  },
  sm: {
    container: "w-7 h-7 text-xs",
    ring: "p-[1.5px]",
    badge: "w-3.5 h-3.5 -bottom-0.5 -right-0.5 p-[2px]",
    badgeIcon: "w-2 h-2",
  },
  md: {
    container: "w-10 h-10 text-sm",
    ring: "p-[2px]",
    badge: "w-4 h-4 -bottom-0.5 -right-0.5 p-[2px]",
    badgeIcon: "w-2.5 h-2.5",
  },
  lg: {
    container: "w-16 h-16 text-xl",
    ring: "p-[2.5px]",
    badge: "w-6 h-6 -bottom-1 -right-1 p-[3px]",
    badgeIcon: "w-3.5 h-3.5",
  },
  xl: {
    container: "w-24 h-24 text-3xl",
    ring: "p-[3px]",
    badge: "w-8 h-8 -bottom-1 -right-1 p-[4px]",
    badgeIcon: "w-5 h-5",
  },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = "md",
  className = "",
  showBadge = true,
}) => {
  const plan = user?.subscription?.plan || (user?.role === "admin" ? "premium" : "free");
  const s = sizeConfig[size] || sizeConfig.md;

  const letter = (user?.username?.[0] || user?.email?.[0] || "U").toUpperCase();

  // Tier styles
  let ringGradient = "bg-zinc-700";
  let innerBg = "bg-zinc-900 text-zinc-300";
  let shadow = "";
  let badgeEl = null;

  if (plan === "premium" || user?.role === "admin") {
    ringGradient = "bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600";
    innerBg = "bg-gradient-to-br from-zinc-900 via-amber-950/40 to-zinc-900 text-amber-300 font-extrabold";
    shadow = "shadow-lg shadow-amber-500/25";
    badgeEl = (
      <div className={`absolute ${s.badge} rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md ring-2 ring-zinc-950`}>
        <IconCrown className={s.badgeIcon} />
      </div>
    );
  } else if (plan === "standard") {
    ringGradient = "bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600";
    innerBg = "bg-gradient-to-br from-zinc-900 via-blue-950/40 to-zinc-900 text-cyan-300 font-bold";
    shadow = "shadow-md shadow-blue-500/20";
    badgeEl = (
      <div className={`absolute ${s.badge} rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md ring-2 ring-zinc-950`}>
        <IconBolt className={s.badgeIcon} />
      </div>
    );
  } else {
    ringGradient = "bg-gradient-to-tr from-zinc-600 to-zinc-700";
    innerBg = "bg-zinc-800 text-zinc-300 font-semibold";
  }

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      <div
        className={`rounded-full ${ringGradient} ${s.ring} ${shadow} transition-transform duration-300 hover:scale-105`}
      >
        <div
          className={`${s.container} rounded-full ${innerBg} flex items-center justify-center overflow-hidden uppercase select-none`}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username || "User"}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span>{letter}</span>
          )}
        </div>
      </div>
      {showBadge && badgeEl}
    </div>
  );
};

export default UserAvatar;
