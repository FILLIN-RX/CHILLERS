"use client";

import { useEffect } from "react";

export interface MediaSessionProps {
  title?: string;
  artist?: string;
  album?: string;
  posterUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

/**
 * Configure les contrôles multimédias sur l'écran de verrouillage
 * (iOS LockScreen, Android Notification bar, Windows Media Overlay)
 */
export function useMediaSession({
  title,
  artist = "CHILLERS",
  album,
  posterUrl,
  videoRef,
  onNextEpisode,
  onPreviousEpisode,
}: MediaSessionProps) {
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (title) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: album || "CHILLERS Streaming",
        artwork: posterUrl
          ? [
              { src: posterUrl, sizes: "96x96", type: "image/png" },
              { src: posterUrl, sizes: "256x256", type: "image/png" },
              { src: posterUrl, sizes: "512x512", type: "image/png" },
            ]
          : [{ src: "/og-image.png", sizes: "1200x630", type: "image/png" }],
      });
    }

    const video = videoRef?.current;

    // Action handlers
    navigator.mediaSession.setActionHandler("play", () => {
      video?.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      video?.pause();
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (video) video.currentTime = Math.max(video.currentTime - skipTime, 0);
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const skipTime = details.seekOffset || 10;
      if (video) video.currentTime = Math.min(video.currentTime + skipTime, video.duration || 0);
    });

    if (onPreviousEpisode) {
      navigator.mediaSession.setActionHandler("previoustrack", onPreviousEpisode);
    }

    if (onNextEpisode) {
      navigator.mediaSession.setActionHandler("nexttrack", onNextEpisode);
    }

    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }
    };
  }, [title, artist, album, posterUrl, videoRef, onNextEpisode, onPreviousEpisode]);
}

export default function MediaSessionController(props: MediaSessionProps) {
  useMediaSession(props);
  return null;
}
