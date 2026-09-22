/**
 * AfrolandTV Stream Resolution Module
 * 
 * Handles extraction of Kaltura entry IDs and HLS stream manifests
 * from AfrolandTV (Ottera OTT Platform + Kaltura CDN partner 513551).
 */

export interface AfrolandStreamResult {
  success: boolean;
  videoId: string;
  entryId: string;
  partnerId: string;
  streamUrl: string;
  proxiedStreamUrl: string;
  title?: string;
  poster?: string;
  error?: string;
}

export interface AfrolandObjectMetadata {
  id: string;
  name: string;
  type: string;
  shortDescription?: string;
  longDescription?: string;
  posterUrl?: string;
  duration?: string;
  year?: string;
  country?: string;
}

const AUTH_TOKEN = "s8B8CYQrUKMFsHFhMU";
const KALTURA_PARTNER_ID = "513551";
const OTTERA_API_BASE = "https://api-ott.afrolandtv.com";

export class AfrolandProvider {
  /**
   * Check if a given URL belongs to AfrolandTV
   */
  static isAfrolandUrl(url?: string | null): boolean {
    if (!url) return false;
    return /afrolandtv\.com/i.test(url);
  }

  /**
   * Extract video ID from HTML or URL/ID string
   */
  static async extractVideoId(urlOrId: string): Promise<string | null> {
    const trimmed = urlOrId.trim();

    // If it's a numeric ID already
    if (/^\d+$/.test(trimmed)) {
      return trimmed;
    }

    if (this.isAfrolandUrl(trimmed)) {
      try {
        const response = await fetch(trimmed, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return null;

        const html = await response.text();
        const otteraMatch =
          html.match(/data-ottera-id=["'](\d+)["']/) ||
          html.match(/node-type-video--(\d+)/) ||
          html.match(/node\/(\d+)/);

        if (otteraMatch) {
          return otteraMatch[1];
        }
      } catch (err) {
        console.error("[AfrolandProvider] Error extracting video ID from URL:", err);
      }
    }

    return null;
  }

  /**
   * Resolve Kaltura entry_id and construct HLS stream playlist URLs
   */
  static async resolveStream(urlOrId: string): Promise<AfrolandStreamResult> {
    const videoId = await this.extractVideoId(urlOrId);

    if (!videoId) {
      return {
        success: false,
        videoId: "",
        entryId: "",
        partnerId: KALTURA_PARTNER_ID,
        streamUrl: "",
        proxiedStreamUrl: "",
        error: "Could not locate valid AfrolandTV video ID",
      };
    }

    try {
      const embedUrl = `${OTTERA_API_BASE}/embeddedVideoPlayer?auth_token=${AUTH_TOKEN}&id=${videoId}&div_id=video_player&image_width=1280`;

      const res = await fetch(embedUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          success: false,
          videoId,
          entryId: "",
          partnerId: KALTURA_PARTNER_ID,
          streamUrl: "",
          proxiedStreamUrl: "",
          error: `Ottera embed API returned status ${res.status}`,
        };
      }

      const embedJs = await res.text();

      const entryMatch =
        embedJs.match(/'entry_id'\s*:\s*'([^']+)'/) ||
        embedJs.match(/"entry_id"\s*:\s*"([^"]+)"/);

      if (!entryMatch) {
        return {
          success: false,
          videoId,
          entryId: "",
          partnerId: KALTURA_PARTNER_ID,
          streamUrl: "",
          proxiedStreamUrl: "",
          error: "Could not extract Kaltura entry_id from player config",
        };
      }

      const entryId = entryMatch[1];

      // Standard Kaltura HLS Master Playlist URL
      const streamUrl = `https://cdnapisec.kaltura.com/p/${KALTURA_PARTNER_ID}/sp/${KALTURA_PARTNER_ID}00/playManifest/entryId/${entryId}/format/applehttp/protocol/https/a.m3u8`;

      const proxiedStreamUrl = `/api/live/proxy?url=${encodeURIComponent(streamUrl)}`;

      return {
        success: true,
        videoId,
        entryId,
        partnerId: KALTURA_PARTNER_ID,
        streamUrl,
        proxiedStreamUrl,
      };
    } catch (err: any) {
      return {
        success: false,
        videoId,
        entryId: "",
        partnerId: KALTURA_PARTNER_ID,
        streamUrl: "",
        proxiedStreamUrl: "",
        error: err?.message || "Failed to resolve AfrolandTV stream",
      };
    }
  }

  /**
   * Retrieve catalog metadata for an AfrolandTV video
   */
  static async getMetadata(videoId: string): Promise<AfrolandObjectMetadata | null> {
    try {
      const res = await fetch(
        `${OTTERA_API_BASE}/getobjects?auth_token=${AUTH_TOKEN}&id=${videoId}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) return null;

      const data = await res.json();
      const obj = data.objects?.find((o: any) => o.id === videoId || o.primary_id === videoId);

      if (!obj) return null;

      return {
        id: obj.id,
        name: obj.name,
        type: obj.type,
        shortDescription: obj.short_description,
        longDescription: obj.long_description,
        posterUrl: obj.screencap_widescreen || obj.img_info?.thumb_poster?.url,
      };
    } catch (err) {
      console.error("[AfrolandProvider] Error fetching metadata:", err);
      return null;
    }
  }
}
