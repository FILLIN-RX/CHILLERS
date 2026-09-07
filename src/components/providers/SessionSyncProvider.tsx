"use client";

import React, { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useAuthStore, type UserProfile } from "@/stores/useAuthStore";

function SessionSyncInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { user, token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const u = session.user as any;
      const backendToken = u.backendToken || token || "nextauth-session-active";

      // Si le store local n'a pas encore l'utilisateur ou a un utilisateur différent
      if (!user || user.id !== u.id || user.email !== u.email) {
        const userProfile: UserProfile = {
          id: u.id,
          email: u.email || "",
          username: u.name || u.email?.split("@")[0],
          role: u.role || "user",
          avatarUrl: u.avatarUrl || u.image,
          subscription: u.subscription || { plan: "free", status: "active" },
          favorites: [],
          continueWatching: [],
          watchHistory: [],
          watchLater: [],
          playlists: [],
        };
        setAuth(backendToken, userProfile);
      }
    } else if (status === "unauthenticated" && token?.startsWith("nextauth-")) {
      logout();
    }
  }, [session, status, user, token, setAuth, logout]);

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
    <SessionProvider session={session}>
      <SessionSyncInner>{children}</SessionSyncInner>
    </SessionProvider>
  );
}
