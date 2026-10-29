/**
 * @jest-environment jsdom
 */

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/refs */

import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { useMidrollVastAd } from "@/hooks/useMidrollVastAd";

type Listener = (event: any) => void;
type MidrollApi = ReturnType<typeof useMidrollVastAd>;

function createImaMock() {
  const loaderListeners = new Map<string, Listener[]>();
  const managerListeners = new Map<string, Listener[]>();

  const manager = {
    init: jest.fn(),
    start: jest.fn(),
    destroy: jest.fn(),
    getRemainingTime: jest.fn(() => 5),
    addEventListener: jest.fn((type: string, listener: Listener) => {
      managerListeners.set(type, [...(managerListeners.get(type) ?? []), listener]);
    }),
  };

  const loader = {
    addEventListener: jest.fn((type: string, listener: Listener) => {
      loaderListeners.set(type, [...(loaderListeners.get(type) ?? []), listener]);
    }),
    requestAds: jest.fn(),
    contentComplete: jest.fn(),
    destroy: jest.fn(),
  };

  const displayContainer = {
    initialize: jest.fn(),
    destroy: jest.fn(),
  };

  const ima = {
    AdDisplayContainer: jest.fn(() => displayContainer),
    AdsLoader: jest.fn(() => loader),
    AdsRequest: jest.fn(() => ({})),
    AdsRenderingSettings: jest.fn(),
    ViewMode: { NORMAL: "normal" },
    AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: "manager-loaded" } },
    AdErrorEvent: { Type: { AD_ERROR: "ad-error" } },
    AdEvent: {
      Type: {
        CONTENT_PAUSE_REQUESTED: "content-pause-requested",
        CONTENT_RESUME_REQUESTED: "content-resume-requested",
        ALL_ADS_COMPLETED: "all-ads-completed",
        AD_PROGRESS: "ad-progress",
        STARTED: "started",
      },
    },
  };

  const emitLoader = (type: string, event: any) => {
    for (const listener of loaderListeners.get(type) ?? []) listener(event);
  };
  const emitManager = (type: string, event: any = {}) => {
    for (const listener of managerListeners.get(type) ?? []) listener(event);
  };

  loader.requestAds = jest.fn(() => {
    emitLoader(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, {
      getAdsManager: () => manager,
    });
  });

  return { ima, manager, loader, displayContainer, emitLoader, emitManager };
}

const VAST_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0"><Ad id="1"><InLine><AdSystem>Test</AdSystem><AdTitle>Test</AdTitle><Impression><![CDATA[https://example.com/impression]]></Impression><Creatives><Creative><Linear><Duration>00:00:30</Duration><MediaFiles><MediaFile delivery="progressive" type="video/mp4" width="640" height="360"><![CDATA[https://example.com/ad.mp4]]></MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`;

async function flushPrefetch() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createVideo() {
  const video = document.createElement("video");
  let paused = false;
  let currentTime = 0;

  Object.defineProperty(video, "duration", { get: () => 600, configurable: true });
  Object.defineProperty(video, "currentTime", {
    get: () => currentTime,
    set: (value: number) => { currentTime = value; },
    configurable: true,
  });
  Object.defineProperty(video, "paused", { get: () => paused, configurable: true });
  Object.defineProperty(video, "seeking", { get: () => false, configurable: true });
  Object.defineProperty(video, "pause", {
    value: jest.fn(() => { paused = true; }),
    configurable: true,
  });
  Object.defineProperty(video, "play", {
    value: jest.fn(() => { paused = false; return Promise.resolve(); }),
    configurable: true,
  });

  return {
    video,
    setTime: (time: number) => { currentTime = time; },
    isPaused: () => paused,
  };
}

function Harness({ video, apiRef }: { video: HTMLVideoElement; apiRef: { current: MidrollApi | null } }) {
  const videoRef = useRef<HTMLVideoElement | null>(video);
  const api = useMidrollVastAd(videoRef, "movie-1");
  apiRef.current = api;

  return (
    <div>
      <div ref={api.adContainerRef}>
        <video ref={api.adVideoRef} />
      </div>
    </div>
  );
}

async function renderMidrollHook(video: HTMLVideoElement) {
  const apiRef: { current: MidrollApi | null } = { current: null };
  const utils = render(<Harness video={video} apiRef={apiRef} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { apiRef, ...utils };
}

describe("useMidrollVastAd", () => {
  let mock: ReturnType<typeof createImaMock>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mock = createImaMock();
    (window as any).google = { ima: mock.ima };
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => VAST_RESPONSE,
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (window as any).google;
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("ne détruit pas la pub préchargée avant le point de rupture", async () => {
    const { video, setTime } = createVideo();
    const { apiRef, unmount } = await renderMidrollHook(video);
    jest.useFakeTimers();

    setTime(270);
    act(() => { apiRef.current!.onContentTimeUpdate(); });
    await flushPrefetch();

    expect(mock.loader.requestAds).toHaveBeenCalledTimes(1);
    expect(mock.manager.init).not.toHaveBeenCalled();
    expect(apiRef.current!.midrollState).toBe("idle");

    act(() => { jest.advanceTimersByTime(10_000); });

    expect(mock.manager.destroy).not.toHaveBeenCalled();
    expect(apiRef.current!.midrollState).toBe("idle");

    unmount();
  });

  it("lance la pub au point de rupture, puis reprend le contenu", async () => {
    const { video, setTime, isPaused } = createVideo();
    const { apiRef, unmount } = await renderMidrollHook(video);

    setTime(270);
    act(() => { apiRef.current!.onContentTimeUpdate(); });
    await flushPrefetch();

    setTime(330);
    act(() => { apiRef.current!.onContentTimeUpdate(); });

    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(isPaused()).toBe(true);
    expect(apiRef.current!.midrollState).toBe("loading");
    expect(mock.manager.init).toHaveBeenCalledTimes(1);
    expect(mock.manager.start).toHaveBeenCalledTimes(1);

    act(() => { mock.emitManager("started"); });
    expect(apiRef.current!.midrollState).toBe("playing");

    act(() => { mock.emitManager("all-ads-completed"); });
    expect(apiRef.current!.midrollState).toBe("idle");
    expect(video.play).toHaveBeenCalled();

    unmount();
  });

  it("ne peut passer la pub qu'après 10 secondes", async () => {
    const { video, setTime } = createVideo();
    const { apiRef, unmount } = await renderMidrollHook(video);
    jest.useFakeTimers();

    setTime(270);
    act(() => { apiRef.current!.onContentTimeUpdate(); });
    await flushPrefetch();

    setTime(330);
    act(() => { apiRef.current!.onContentTimeUpdate(); });

    act(() => { mock.emitManager("started"); });
    expect(apiRef.current!.midrollState).toBe("playing");
    expect(apiRef.current!.canSkip).toBe(false);
    expect(apiRef.current!.skipSeconds).toBe(10);

    act(() => { expect(apiRef.current!.skipAd()).toBe(false); });
    expect(apiRef.current!.midrollState).toBe("playing");

    act(() => { jest.advanceTimersByTime(9_000); });
    expect(apiRef.current!.canSkip).toBe(false);
    expect(apiRef.current!.skipSeconds).toBe(1);

    act(() => { jest.advanceTimersByTime(1_000); });
    expect(apiRef.current!.canSkip).toBe(true);

    act(() => { expect(apiRef.current!.skipAd()).toBe(true); });
    expect(apiRef.current!.midrollState).toBe("idle");
    expect(mock.manager.destroy).toHaveBeenCalled();
    expect(video.play).toHaveBeenCalled();

    unmount();
  });

  it("ne met pas le contenu en attente quand le tag ne renvoie aucune pub", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mock.loader.requestAds.mockImplementation(() => {
      mock.emitLoader("ad-error", {
        getError: () => ({
          getErrorCode: () => 303,
          getMessage: () => "No Ads VAST response after one or more Wrappers",
        }),
      });
    });

    const { video, setTime } = createVideo();
    const { apiRef, unmount } = await renderMidrollHook(video);

    setTime(270);
    act(() => { apiRef.current!.onContentTimeUpdate(); });
    await flushPrefetch();

    setTime(330);
    act(() => { apiRef.current!.onContentTimeUpdate(); });

    expect(video.pause).not.toHaveBeenCalled();
    expect(apiRef.current!.midrollState).toBe("idle");

    unmount();
  });
});
