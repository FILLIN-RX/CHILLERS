import { applyLiveScores } from "@/lib/live-scores";
import type { LiveScoreUpdate } from "@/services/sports";
import type { SportsMatch } from "@/types/sports";

const liveball = (id: string, score: string, minute?: string): SportsMatch => ({
  id: `liveball:${id}`,
  sourceId: id,
  source: "liveball",
  status: "live",
  home: "Kasympasha",
  away: "Chorluspor",
  score,
  minute,
});

const kora = (id: string, score: string): SportsMatch => ({
  id: `kora:${id}`,
  sourceId: id,
  source: "kora",
  status: "live",
  home: "Future FC",
  away: "Al Ahly",
  score,
});

const scores = new Map<string, LiveScoreUpdate>([
  ["liveball:1645437", { source: "liveball", id: "1645437", score: "1 : 0", minute: "73′" }],
]);

it("remplace le score et la minute de la carte LiveBall", () => {
  const [match] = applyLiveScores([liveball("1645437", "0 : 0", "68′")], scores);
  expect(match.score).toBe("1 : 0");
  expect(match.minute).toBe("73′");
});

it("garde la minute quand le relevé n'en publie pas", () => {
  const [match] = applyLiveScores([liveball("1645437", "0 : 0", "68′")], new Map([
    ["liveball:1645437", { source: "liveball" as const, id: "1645437", score: "1 : 0" }],
  ]));
  expect(match.minute).toBe("68′");
});

it("ne touche pas les autres sources ni les matchs absents du relevé", () => {
  const matches = applyLiveScores([kora("651", "0 : 1"), liveball("999", "2 : 2")], scores);
  expect(matches[0].score).toBe("0 : 1");
  expect(matches[1].score).toBe("2 : 2");
});

it("préserve le reste de la carte", () => {
  const [match] = applyLiveScores([liveball("1645437", "0 : 0")], scores);
  expect(match.home).toBe("Kasympasha");
  expect(match.source).toBe("liveball");
  expect(match.id).toBe("liveball:1645437");
});
