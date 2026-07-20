import { NextResponse, type NextRequest } from "next/server";

// P2-#30: Mirror the user's language preference into a cookie so the server
// can render the right language on the first byte. Without this the layout
// renders `defaultLanguage` (fr) and the client re-hydrates to `en` after
// mount, producing a one-frame language flash.
const COOKIE_NAME = "chillers-lang";
const ALLOWED = new Set(["fr", "en"]);

// Next 16 calls this `proxy` (renamed from `middleware`). The function still
// receives NextRequest and returns NextResponse, same as before.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Only set the cookie if it's missing or stale — don't churn the Set-Cookie
  // header on every request once the user has settled.
  const current = request.cookies.get(COOKIE_NAME)?.value;
  if (!current || !ALLOWED.has(current)) {
    // Default to "fr" on first visit; the client will overwrite this as soon
    // as `LanguageContext` mounts and reads navigator.language / localStorage.
    response.cookies.set(COOKIE_NAME, "fr", {
      path: "/",
      sameSite: "lax",
      // 1 year — long enough that we don't re-prompt within a session.
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  // Skip Next internals and static assets — the cookie has no effect there.
  matcher: ["/((?!_next/|favicon|.*\\..*).*)"],
};
