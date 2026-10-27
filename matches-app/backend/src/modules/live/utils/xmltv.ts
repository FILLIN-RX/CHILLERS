/**
 * Parseur XMLTV minimaliste, sans dépendance externe.
 *
 * Le fichier EPGShare FR1 pèse ~47 Mo décompressé : on évite un parseur DOM
 * complet et on extrait uniquement les champs utiles. Les dates sont converties
 * en epoch milliseconds UTC, quel que soit le fuseau déclaré par la source.
 */

export interface XmltvProgram {
  channelId: string;
  title: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  episode?: string;
  /** epoch ms */
  start: number;
  /** epoch ms */
  end: number;
}

export interface ParsedXmltv {
  /** Identifiant XMLTV → noms d'affichage. */
  channels: Map<string, string[]>;
  /** Identifiant XMLTV → programmes triés par début. */
  programs: Map<string, XmltvProgram[]>;
  programCount: number;
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;|&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#(\d+);/gu, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/giu, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function textContent(value: string): string {
  const withoutCdata = value.replace(/<!\[CDATA\[|\]\]>/gu, "");
  return decodeXmlEntities(withoutCdata.replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "u");
  const raw = re.exec(attrs)?.[1];
  return raw == null ? undefined : decodeXmlEntities(raw);
}

export function parseXmltvTime(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/u.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (!tz) return utc;
  const sign = tz.startsWith("-") ? -1 : 1;
  const offsetMin = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));
  return utc - offsetMin * 60_000;
}

/** Normalisation partagée par le matching EPG : `Canal+` ≡ `CanalPlus`. */
export function normalizeEpgKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\+/gu, "plus")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/gu, "");
}

export function parseXmltv(xml: string): ParsedXmltv {
  const channels = new Map<string, string[]>();

  for (const match of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gu)) {
    const id = attrValue(match[1], "id");
    if (!id) continue;
    const names = [...match[2].matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gu)]
      .map((name) => textContent(name[1]))
      .filter(Boolean);
    channels.set(id, names);
  }

  const programs = new Map<string, XmltvProgram[]>();

  for (const match of xml.matchAll(/<programme\b([^>]+)>([\s\S]*?)<\/programme>/gu)) {
    const attrs = match[1];
    const channelId = attrValue(attrs, "channel");
    const startRaw = attrValue(attrs, "start");
    const stopRaw = attrValue(attrs, "stop");
    if (!channelId || !startRaw || !stopRaw) continue;

    const body = match[2];
    const title = textContent(/<title\b[^>]*>([\s\S]*?)<\/title>/u.exec(body)?.[1] ?? "");
    if (!title) continue;

    const start = parseXmltvTime(startRaw);
    const end = parseXmltvTime(stopRaw);
    if (start == null || end == null || end <= start) continue;

    const program: XmltvProgram = {
      channelId,
      title,
      start,
      end,
    };

    const subTitle = textContent(/<sub-title\b[^>]*>([\s\S]*?)<\/sub-title>/u.exec(body)?.[1] ?? "");
    if (subTitle) program.subTitle = subTitle;

    const description = textContent(/<desc\b[^>]*>([\s\S]*?)<\/desc>/u.exec(body)?.[1] ?? "");
    if (description) program.description = description;

    const category = textContent(/<category\b[^>]*>([\s\S]*?)<\/category>/u.exec(body)?.[1] ?? "");
    if (category) program.category = category;

    const icon = attrValue(/<icon\b([^>]*)\/?>/u.exec(body)?.[1] ?? "", "src");
    if (icon) program.icon = icon;

    const episode = textContent(/<episode-num\b[^>]*>([\s\S]*?)<\/episode-num>/u.exec(body)?.[1] ?? "");
    if (episode) program.episode = episode;

    const list = programs.get(channelId);
    if (list) list.push(program);
    else programs.set(channelId, [program]);
  }

  let programCount = 0;
  for (const list of programs.values()) {
    list.sort((a, b) => a.start - b.start);
    programCount += list.length;
  }

  return { channels, programs, programCount };
}
