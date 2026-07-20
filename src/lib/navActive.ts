// Shared active-nav resolver. Used by both the top <Header> and the mobile
// <BottomNav> so the two indicators never disagree (e.g. /categories used to
// light up the header underline but not the bottom-nav dot).
export type NavTabId = "home" | "movies" | "series" | "anime" | "categories";

export function getActiveNavTab(pathname: string | null | undefined): NavTabId {
  const p = pathname ?? "";
  if (p === "/" || p === "") return "home";
  if (p.startsWith("/media/movies")) return "movies";
  if (p.startsWith("/media/series")) return "series";
  if (p.startsWith("/media/anime")) return "anime";
  if (p.startsWith("/tv")) return "series";
  if (p.startsWith("/categories")) return "categories";
  // Watch + media detail pages stay on the originating tab; default to home.
  return "home";
}
