// Shared active-nav resolver. Used by both the top <Header> and the mobile
// <BottomNav> so the two indicators never disagree (e.g. /categories used to
// light up the header underline but not the bottom-nav dot).
export type NavTabId = "home" | "movies" | "series" | "anime" | "live" | "categories";

function resolveDetailTabFromType(typeParam: string | null | undefined): NavTabId {
  if (typeParam === "movie") return "movies";
  if (typeParam === "anime") return "anime";
  if (typeParam === "tv" || typeParam === "series") return "series";
  return "home";
}

export function getActiveNavTab(
  pathname: string | null | undefined,
  typeParam?: string | null,
): NavTabId {
  const p = pathname ?? "";
  if (p === "/" || p === "") return "home";
  if (p.startsWith("/media/movies")) return "movies";
  if (p.startsWith("/media/series")) return "series";
  if (p.startsWith("/media/anime")) return "anime";
  if (p.startsWith("/live")) return "live";
  if (p.startsWith("/tv")) return "series";
  if (p.startsWith("/categories")) return "categories";
  if (p.startsWith("/watch/")) return resolveDetailTabFromType(typeParam);
  if (/^\/media\/(?!movies$|series$|anime$)(.+)$/.test(p)) {
   return resolveDetailTabFromType(typeParam);
  }
  return "home";
}
