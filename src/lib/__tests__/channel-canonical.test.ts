import { canonicalChannelKey, channelPriority } from "../channel-canonical";

describe("canonicalChannelKey", () => {
  it("regroupe les variantes françaises d'une même chaîne", () => {
    expect(canonicalChannelKey("France 24 Français")).toBe(canonicalChannelKey("FRANCE 24"));
    expect(canonicalChannelKey("LCP Assemblée nationale")).toBe(canonicalChannelKey("LCP"));
    expect(canonicalChannelKey("LCP ASSEMBLEE NATIONALE")).toBe(canonicalChannelKey("LCP"));
    expect(canonicalChannelKey("Public Sénat")).toBe(canonicalChannelKey("PUBLIC SENAT"));
  });

  it("ne fusionne pas les chaînes réellement distinctes", () => {
    expect(canonicalChannelKey("France 24 Français")).not.toBe(canonicalChannelKey("France 24 English"));
    expect(canonicalChannelKey("France 24 Français")).not.toBe(canonicalChannelKey("France 24 العربية"));
    expect(canonicalChannelKey("MEZZO")).not.toBe(canonicalChannelKey("MEZZO LIVE"));
    expect(canonicalChannelKey("WARNER")).not.toBe(canonicalChannelKey("WARNER TV"));
    expect(canonicalChannelKey("DAZN 2")).not.toBe(canonicalChannelKey("DAZN 2 LEAUGE 1"));
  });
});

describe("channelPriority", () => {
  it("préfère un flux stable non-OHA à un flux OHA", () => {
    expect(channelPriority({ name: "FRANCE 24", streamUrl: "https://seed.example/live.m3u8", source: "seed" }))
      .toBeGreaterThan(channelPriority({ name: "FRANCE 24", streamUrl: "https://oha.example/live.m3u8", source: "oha" }));
  });

  it("préfère un flux OHA à une chaîne sans flux mais résoluble", () => {
    expect(channelPriority({ name: "TF1", streamUrl: "https://oha.example/live.m3u8", source: "oha" }))
      .toBeGreaterThan(channelPriority({ name: "TF1", ohaId: "123", source: "oha" }));
  });

  it("écarte les chaînes sans flux ni source résoluble", () => {
    expect(channelPriority({ name: "TV8 Mont-Blanc", source: "seed" })).toBe(0);
  });
});
