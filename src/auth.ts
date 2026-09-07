import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "chillers-nextauth-secret-key-32bytes-secure-production-2026",
  basePath: "/api/nextauth",
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        deviceId: { label: "DeviceId", type: "text" },
        deviceName: { label: "DeviceName", type: "text" },
        forceDisconnect: { label: "ForceDisconnect", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              deviceId: credentials.deviceId,
              deviceName: credentials.deviceName,
              forceDisconnectOthers: credentials.forceDisconnect === "true",
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.success || !data.data?.token) {
            throw new Error(data.message || "Identifiants invalides");
          }

          const user = data.data.user;
          return {
            id: user.id || user._id,
            email: user.email,
            name: user.username || user.name || user.email.split("@")[0],
            role: user.role || "user",
            avatarUrl: user.avatarUrl,
            subscription: user.subscription,
            backendToken: data.data.token,
          } as any;
        } catch (error: any) {
          throw new Error(error.message || "Erreur de connexion");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
        token.subscription = (user as any).subscription;
        token.avatarUrl = (user as any).avatarUrl;
        token.backendToken = (user as any).backendToken;
      }
      if (account?.provider === "google") {
        token.provider = "google";
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role || "user";
        (session.user as any).subscription = token.subscription;
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).backendToken = token.backendToken;
      }
      return session;
    },
  },
});
