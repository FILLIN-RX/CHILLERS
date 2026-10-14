# Implementation Plan: TMDb Logo Integration

## Context

Integrate official TMDb logos (PNG transparents) into hero banners to replace text titles with cinematic branding, similar to Netflix/Disney+. The logos are retrieved from TMDb's `/movie/{id}/images` and `/tv/{id}/images` endpoints, filtered for English or null language, and displayed with lazy loading.

### Technical Stack
- Next.js 16.2.10 with App Router
- React 19.2.4
- TypeScript 5
- Build: `npm run build` (Next.js build)
- Test: `npm test` (Jest with ts-jest)
- Image Optimization: next/image

### Key Files Identified
- `/home/ruxel/CHILLERS/src/types/media.ts` — Type definitions (line 47: MovieOrShow interface)
- `/home/ruxel/CHILLERS/src/services/media.ts` — API service layer (lines 1-909+, getTmdbImageUrl at line 50)
- `/home/ruxel/CHILLERS/src/components/HeroCarousel.tsx` — Home page hero carousel (line 260: h1 title)
- `/home/ruxel/CHILLERS/src/app/(main)/media/[slug]/client-page.tsx` — Media detail page (line 556: h1 title in hero section)

### TMDb Logo Configuration
- Endpoint: `/movie/{id}/images` or `/tv/{id}/images` with `include_image_language=en,null`
- Base URL: `https://image.tmdb.org/t/p/`
- Available sizes: `w45`, `w92`, `w154`, `w185`, `w300`, `w500`, `original`
- Selection logic: w300 on slow connections, w500 otherwise
- Cache TTL: 30 minutes (1800000ms)

---

## Implementation Steps

- [ ] 1. **Add logoUrl field to MovieOrShow type**
      
      Add optional `logoUrl?: string` field to the MovieOrShow interface to store the resolved logo URL.
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/types/media.ts` (line 47, after `posterUrl: string;`)
      
      **Changes:**
      ```typescript
      export interface MovieOrShow {
        id: string;
        title: string;
        type: MediaType;
        description: string;
        synopsis: string;
        backdropUrl: string;
        backdropOriginalUrl?: string;
        posterUrl: string;
        logoUrl?: string;  // ADD THIS LINE
        rating: number;
        // ... rest of interface
      }
      ```
      
      **Verify:** Run `npm run build` and confirm TypeScript compilation succeeds without errors.

---

- [ ] 2. **Extend getTmdbImageUrl() to support 'logo' type**
      
      Add 'logo' as a new image type to the existing getTmdbImageUrl function. Use w300 for slow connections, w500 otherwise.
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/services/media.ts` (lines 50-81, function getTmdbImageUrl)
      
      **Changes:**
      Modify the function signature on line 50:
      ```typescript
      export function getTmdbImageUrl(
        path?: string | null,
        type: "poster" | "backdrop" | "still" | "logo" = "poster",
        original = false,
      ): string {
      ```
      
      Add logo case before the final default return (around line 76):
      ```typescript
      if (type === "logo") {
        if (ultraLow) return `https://image.tmdb.org/t/p/w185${path}`;
        return `https://image.tmdb.org/t/p/${weak ? "w300" : "w500"}${path}`;
      }
      ```
      
      **Verify:** Run `npm run build` and confirm TypeScript compilation succeeds.

---

- [ ] 3. **Implement getMediaLogo() function**
      
      Create a new function that fetches logos from TMDb's `/images` endpoint, caches results for 30 minutes, and returns the best logo URL (highest vote_average).
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/services/media.ts` (insert after getMediaTrailerUrl at approximately line 950, before enrichHeroSlidesWithTrailers)
      
      **Changes:**
      ```typescript
      /**
       * Récupère l'URL du logo officiel TMDb pour un film ou une série à la demande.
       * Filtre les logos en anglais (en) ou sans langue (null) et prend celui avec le meilleur vote.
       * Mise en cache 30 minutes.
       */
      export async function getMediaLogo(
        id: string,
        isTV = false,
        signal?: AbortSignal,
      ): Promise<string | null> {
        const cacheKey = `media_logo:${isTV ? "tv" : "movie"}:${id}`;
        const cached = getCached<string>(cacheKey);
        if (cached) return cached;

        const endpoint = isTV ? `/tv/${id}` : `/movie/${id}`;
        try {
          const data = await fetchDirectTMDB<{
            logos?: Array<{
              file_path: string;
              iso_639_1: string | null;
              vote_average?: number;
            }>;
          }>(`${endpoint}/images`, { include_image_language: "en,null" }, signal);
          
          if (data?.logos && data.logos.length > 0) {
            // Priorité : logos en anglais ou sans langue, triés par vote_average
            const sorted = data.logos
              .filter((logo) => logo.iso_639_1 === "en" || logo.iso_639_1 === null)
              .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
            
            if (sorted.length > 0 && sorted[0].file_path) {
              const url = getTmdbImageUrl(sorted[0].file_path, "logo");
              setCached(cacheKey, url, 30 * 60 * 1000);
              return url;
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          console.warn(`[Logo Fetch] Failed for ${isTV ? "TV" : "Movie"} ${id}:`, err);
        }
        
        return null;
      }
      ```
      
      **Imports to verify are present:** `fetchDirectTMDB`, `getCached`, `setCached`, `getTmdbImageUrl` (all already imported in media.ts)
      
      **Verify:** Run `npm run build` and confirm TypeScript compilation succeeds.

---

- [ ] 4. **Add lazy logo loading to HeroCarousel**
      
      Implement logo loading with debounce (800ms), cache Map, and display with fallback to text title.
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/components/HeroCarousel.tsx`
      
      **Changes:**
      
      A. Add state and ref after existing useState declarations (around line 35, after `const [isMobile, setIsMobile] = useState(false);`):
      ```typescript
      const [logoMap, setLogoMap] = useState<Record<string, string>>({});
      const logoMapRef = useRef<Record<string, string>>({});
      ```
      
      B. Add useEffect for lazy logo loading (after the trailer loading useEffect, around line 75):
      ```typescript
      // Lazy loading du logo pour la slide active (même pattern que trailer)
      useEffect(() => {
        if (!slides || slides.length === 0 || isPaused || isMobile) return;
        const currentSlide = slides[currentIndex];
        if (!currentSlide) return;

        // Si logo déjà en cache
        const existingLogo = logoMapRef.current[currentSlide.id];
        if (existingLogo) return;

        // Charger après 800ms (debounce)
        const loadTimer = setTimeout(async () => {
          try {
            const { getMediaLogo } = await import("@/services/media");
            const isTV = currentSlide.type === "series" || currentSlide.type === "anime";
            const logoUrl = await getMediaLogo(currentSlide.id, isTV);
            if (logoUrl) {
              logoMapRef.current[currentSlide.id] = logoUrl;
              setLogoMap((prev) => ({ ...prev, [currentSlide.id]: logoUrl }));
            }
          } catch {}
        }, 800);

        return () => clearTimeout(loadTimer);
      }, [currentIndex, slides, isPaused, isMobile]);
      ```
      
      C. Add import at top of file (line 9, after existing imports):
      ```typescript
      import { getMediaLogo } from "@/services/media";
      ```
      
      D. Replace the h1 title element (line 260, inside the slide content div):
      
      Find this block:
      ```typescript
      <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl font-sans drop-shadow-lg leading-tight line-clamp-2">
        {slide.title}
      </h1>
      ```
      
      Replace with:
      ```typescript
      {logoMap[slide.id] ? (
        <div className="relative">
          <Image
            src={logoMap[slide.id]}
            alt={slide.title}
            width={500}
            height={150}
            className="max-w-[280px] sm:max-w-[400px] h-auto max-h-[100px] sm:max-h-[150px] object-contain drop-shadow-2xl transition-opacity duration-500 animate-in fade-in"
            priority={false}
            quality={95}
          />
          <span className="sr-only">{slide.title}</span>
        </div>
      ) : (
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl font-sans drop-shadow-lg leading-tight line-clamp-2">
          {slide.title}
        </h1>
      )}
      ```
      
      **Verify:** Run `npm run build` and confirm successful compilation. Manually test hero carousel at `http://localhost:3000` to verify logos load after 800ms and fall back to text when unavailable.

---

- [ ] 5. **Add lazy logo loading to media detail page**
      
      Apply the same logo loading logic to the detail page hero section.
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/app/(main)/media/[slug]/client-page.tsx`
      
      **Changes:**
      
      A. Add state and ref after existing useState declarations (around line 55, after `const [castCanScrollRight, setCastCanScrollRight] = useState(false);`):
      ```typescript
      const [logoUrl, setLogoUrl] = useState<string | null>(null);
      const [logoLoading, setLogoLoading] = useState(false);
      ```
      
      B. Add useEffect to load logo when item changes (around line 90, after the selectedLang useEffect):
      ```typescript
      // Lazy loading du logo pour le media actuel
      useEffect(() => {
        if (!item || logoLoading) return;
        
        setLogoLoading(true);
        const loadLogo = async () => {
          try {
            const { getMediaLogo } = await import("@/services/media");
            const logo = await getMediaLogo(item.id, isTV);
            setLogoUrl(logo);
          } catch (err) {
            console.warn("Failed to load logo:", err);
          } finally {
            setLogoLoading(false);
          }
        };
        
        loadLogo();
      }, [item?.id, isTV]);
      ```
      
      C. Add import at top of file (around line 11, after existing service imports):
      ```typescript
      import { getMediaLogo } from "@/services/media";
      ```
      
      D. Replace the h1 title element in the hero section (line 556):
      
      Find this block:
      ```typescript
      {/* Titre */}
      <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl">
        {item.title}
      </h1>
      ```
      
      Replace with:
      ```typescript
      {/* Titre ou Logo */}
      {logoUrl ? (
        <div className="relative">
          <Image
            src={logoUrl}
            alt={item.title}
            width={500}
            height={150}
            className="max-w-[280px] sm:max-w-[400px] h-auto max-h-[100px] sm:max-h-[150px] object-contain drop-shadow-2xl"
            priority
            quality={95}
          />
          <span className="sr-only">{item.title}</span>
        </div>
      ) : (
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-xl">
          {item.title}
        </h1>
      )}
      ```
      
      **Verify:** Run `npm run build` and confirm successful compilation. Manually navigate to a media detail page (e.g., `/media/550`) and verify the logo displays or falls back to text title.

---

- [ ] 6. **Optional: Pre-populate logoUrl in mapTMDBToMovieOrShow**
      
      For performance optimization in future iterations, you can extend mapTMDBToMovieOrShow to extract logos from the TMDb response if they include `append_to_response=images`. This step is OPTIONAL and not required for initial implementation.
      
      **Files:**
      - `/home/ruxel/CHILLERS/src/services/media.ts` (function mapTMDBToMovieOrShow, around line 140)
      
      **Changes:**
      Inside mapTMDBToMovieOrShow, after the trailerUrl extraction (around line 330), add:
      ```typescript
      // Extract logo if available in images append
      let logoPath: string | null = null;
      if (item.images?.logos && Array.isArray(item.images.logos)) {
        const logos = item.images.logos
          .filter((logo: any) => logo.iso_639_1 === "en" || logo.iso_639_1 === null)
          .sort((a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0));
        if (logos.length > 0 && logos[0].file_path) {
          logoPath = logos[0].file_path;
        }
      }
      ```
      
      Then in the return statement (around line 400), add:
      ```typescript
      logoUrl: logoPath ? getTmdbImageUrl(logoPath, "logo") : undefined,
      ```
      
      **Note:** This requires that the backend or direct TMDb calls use `append_to_response=images`. The TmdbRawItem type would also need to be extended with `images?: { logos?: Array<{ file_path: string; iso_639_1: string | null; vote_average?: number }> }`.
      
      **Verify:** Run `npm run build`. This step can be deferred if images are not currently appended to responses.

---

## Summary

This plan integrates TMDb logos into both the home hero carousel and media detail pages using lazy loading with debounce (800ms), client-side caching (30 min TTL), and graceful fallback to text titles. The implementation:

1. Adds `logoUrl` to the media type
2. Extends `getTmdbImageUrl()` to support logo sizes (w300/w500)
3. Creates `getMediaLogo()` to fetch and cache logos from TMDb
4. Implements lazy loading in `HeroCarousel` with logoMap state
5. Implements lazy loading in detail page with logoUrl state
6. Ensures accessibility with `sr-only` spans
7. Maintains all existing UI elements (badges, metadata, buttons)

**Build command:** `npm run build`  
**Test command:** `npm test` (currently has watchman issue, but TypeScript compilation in build validates syntax)  
**Manual verification:** Start dev server with `npm run dev`, navigate to home and detail pages, verify logos load or fallback renders.
