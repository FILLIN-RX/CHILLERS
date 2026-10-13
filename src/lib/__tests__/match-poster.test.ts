import {
  findPoster,
  formatMatchDay,
  isMajorCompetition,
  normalizeTeam,
  presentCompetition,
  type PosterFixture,
} from "../match-poster";

const uclLens: PosterFixture = {
  id: "401915418",
  home: "Lens",
  away: "Sporting CP",
  homeLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/175.png",
  awayLogo: "https://a.espncdn.com/i/teamlogos/soccer/500/2250.png",
  leagueId: "uefa.champions",
  leagueName: "Ligue des Champions",
  leagueSlug: "champions-league",
  leagueLogo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  status: "upcoming",
  startTs: 1791909900,
};

const serieA: PosterFixture = {
  ...uclLens,
  id: "401900001",
  home: "Inter Milan",
  away: "AC Milan",
  leagueId: "ita.1",
  leagueName: "Serie A",
  leagueSlug: "serie-a",
};

const fixtures = [uclLens, serieA];

describe("isMajorCompetition", () => {
  it("reconnait les grandes compétitions quelle que soit la graphie de la source", () => {
    expect(isMajorCompetition("UEFA Champions League")).toBe(true);
    expect(isMajorCompetition("Champions League")).toBe(true);
    expect(isMajorCompetition("Ligue Europa")).toBe(true);
    expect(isMajorCompetition("Premier League")).toBe(true);
    expect(isMajorCompetition("LaLiga")).toBe(true);
    expect(isMajorCompetition("Soccer, UEFA - Champions League")).toBe(true);
  });

  it("écarte les divisions homonymes, les coupes continentales mineures et les rencontres sans ligue", () => {
    expect(isMajorCompetition("Egypt. Premier League")).toBe(false);
    expect(isMajorCompetition("AFC Champions League Elite")).toBe(false);
    expect(isMajorCompetition("Saudi Arabia. Division 1")).toBe(false);
    expect(isMajorCompetition("Women. World Cup Qualification. Europe")).toBe(false);
    expect(isMajorCompetition(undefined)).toBe(false);
    expect(isMajorCompetition("")).toBe(false);
  });
});

describe("normalizeTeam", () => {
  it("plie les francisations et abréviations des sources live sur celles du score", () => {
    expect(normalizeTeam("RC Lens")).toBe(normalizeTeam("Lens"));
    expect(normalizeTeam("FC Barcelone")).toBe(normalizeTeam("Barcelona"));
    expect(normalizeTeam("Club Bruges")).toBe(normalizeTeam("Club Brugge"));
    expect(normalizeTeam("Paris Saint-Germain")).toBe(normalizeTeam("PSG"));
    // Les sources ajoutent le statut associatif du club, pas toujours le même :
    // sans cette égalité, deux cartes décrivent la même rencontre.
    expect(normalizeTeam("Sabah FA")).toBe(normalizeTeam("Sabah FK"));
    expect(normalizeTeam("Inter")).toBe(normalizeTeam("Internazionale"));
  });
});

describe("presentCompetition", () => {
  it("lit un slug publié par une source live comme une étiquette", () => {
    expect(presentCompetition("uefa-champions-league")).toBe("UEFA Champions League");
    expect(presentCompetition("la-liga")).toBe("La Liga");
    expect(presentCompetition("premier league")).toBe("Premier League");
  });

  it("laisse intactes les étiquettes déjà lisibles des autres sources", () => {
    expect(presentCompetition("Eredivisie")).toBe("Eredivisie");
    expect(presentCompetition("Ligue des Champions UCL")).toBe("Ligue des Champions UCL");
    expect(presentCompetition("")).toBeNull();
    expect(presentCompetition(undefined)).toBeNull();
  });
});

describe("formatMatchDay", () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const kickoff = (day: number) => Math.floor(new Date(2026, 9, day, 20, 0, 0).getTime() / 1000);

  it("nomme le jour en relatif autour d'aujourd'hui", () => {
    expect(formatMatchDay(kickoff(13), now)).toBe("Aujourd'hui");
    expect(formatMatchDay(kickoff(14), now)).toBe("Demain");
    expect(formatMatchDay(kickoff(12), now)).toBe("Hier");
  });

  it("donne la date courte au-delà, et rien sans coup d'envoi", () => {
    expect(formatMatchDay(kickoff(18), now)).toBe("dim. 18 oct.");
    expect(formatMatchDay(undefined, now)).toBeNull();
  });
});

describe("findPoster", () => {
  it("rattache une rencontre dont la source abrége le nom des clubs", () => {
    const found = findPoster(fixtures, { home: "Lens", away: "Sporting", startTs: 1791909900 });
    expect(found?.fixture.leagueName).toBe("Ligue des Champions");
    expect(found?.fixture.awayLogo).toBe(uclLens.awayLogo);
  });

  it("accepte les sources qui inversent domicile et extérieur", () => {
    const found = findPoster(fixtures, { home: "Sporting CP", away: "RC Lens", startTs: 1791909900 });
    expect(found?.swapped).toBe(true);
    expect(found?.fixture.id).toBe(uclLens.id);
  });

  it("refuse la jointure quand la rencontre n'est pas de la même journée", () => {
    // Le service de score renvoie la précédente journée quand rien n'est programmé :
    // sans cette fenêtre, un match de coupe entre les deux mêmes clubs hériterait
    // du badge du championnat.
    expect(findPoster(fixtures, { home: "Lens", away: "Sporting CP", startTs: 1791909900 + 30 * 86400 })).toBeNull();
  });

  it("ne joint rien quand les clubs ne correspondent pas", () => {
    expect(findPoster(fixtures, { home: "Al Sadd", away: "Al-Hilal" })).toBeNull();
    expect(findPoster([], { home: "Lens", away: "Sporting CP" })).toBeNull();
  });
});
