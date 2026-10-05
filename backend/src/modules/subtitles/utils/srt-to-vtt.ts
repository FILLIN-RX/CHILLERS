/**
 * Convertit un contenu SRT (SubRip) en format WebVTT standardisé.
 */
export function srtToVtt(srt: string): string {
  const cleaned = srt
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const body = cleaned
    .split('\n')
    .map((line) => line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'))
    .join('\n');

  return `WEBVTT\n\n${body.replace(/^\s*(\d+)\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
