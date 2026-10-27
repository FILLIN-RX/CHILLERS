type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

export function isFullscreenActive(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function enterFullscreen(
  element: HTMLElement,
  video?: HTMLVideoElement | null,
): Promise<boolean> {
  const target = element as FullscreenElement;
  try {
    if (typeof target.requestFullscreen === "function") {
      await target.requestFullscreen();
      return true;
    }
    if (typeof target.webkitRequestFullscreen === "function") {
      await target.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // iOS Safari exposes native fullscreen on the video element instead.
  }

  const nativeVideo = video as FullscreenVideo | null | undefined;
  if (typeof nativeVideo?.webkitEnterFullscreen === "function") {
    nativeVideo.webkitEnterFullscreen();
    return true;
  }
  return false;
}

export async function exitFullscreen(video?: HTMLVideoElement | null): Promise<void> {
  const doc = document as FullscreenDocument;
  if (typeof doc.exitFullscreen === "function") {
    await doc.exitFullscreen();
    return;
  }
  if (typeof doc.webkitExitFullscreen === "function") {
    await doc.webkitExitFullscreen();
    return;
  }
  const nativeVideo = video as FullscreenVideo | null | undefined;
  if (typeof nativeVideo?.webkitExitFullscreen === "function") {
    nativeVideo.webkitExitFullscreen();
  }
}
