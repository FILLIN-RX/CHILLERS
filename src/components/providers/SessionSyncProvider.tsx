"use client";

import React, { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useAuthStore, type UserProfile } from "@/stores/useAuthStore";
import { userService } from "@/services/user";

function SessionSyncInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    const { token, setAuth, logout, user } = useAuthStore.getState();

    if (status === "authenticated" && session?.user) {
      const u = session.user as any;
      const backendToken = u.backendToken || token;

      if (u.userData) {
        setAuth(backendToken || "nextauth-session-active", u.userData);
      } else if (!user || user.id !== u.id || user.email !== u.email) {
        const userProfile: UserProfile = {
          id: u.id,
          email: u.email || "",
          username: u.name || u.email?.split("@")[0],
          role: u.role || "user",
          avatarUrl: u.avatarUrl || u.image,
          subscription: u.subscription || { plan: "free", status: "active" },
          favorites: user?.favorites || [],
          continueWatching: user?.continueWatching || [],
          watchHistory: user?.watchHistory || [],
          watchLater: user?.watchLater || [],
          playlists: user?.playlists || [],
        };
        setAuth(backendToken || "nextauth-session-active", userProfile);
      }

      // Always fetch fresh full profile from backend to ensure playlists, favorites, etc. are loaded
      if (backendToken && backendToken !== "nextauth-session-active") {
        userService.getProfile(backendToken)
          .then((res) => {
            if (res.success && res.user) {
              setAuth(backendToken, res.user);
            }
          })
          .catch((err) => {
            console.error("[SessionSync] Erreur chargement profil complet:", err);
          });
      }
    } else if (status === "unauthenticated" && token?.startsWith("nextauth-")) {
      logout();
    }
  }, [session, status]);

  return <>{children}</>;
}

export default function SessionSyncProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: any;
}) {
  return (
    <SessionProvider
      session={session}
      basePath="/api/nextauth"
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      <SessionSyncInner>{children}</SessionSyncInner>
    </SessionProvider>
  );
}
