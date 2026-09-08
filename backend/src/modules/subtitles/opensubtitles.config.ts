export const OPENSUBTITLES_USER = (process.env.OPENSUBTITLES_USER || '').trim();
export const OPENSUBTITLES_PASS = (process.env.OPENSUBTITLES_PASS || '').trim();
export const OPENSUBTITLES_API_KEY = (process.env.OPENSUBTITLES_API_KEY || '').trim();

export function isOpenSubtitlesConfigured(): boolean {
    return !!OPENSUBTITLES_USER && !!OPENSUBTITLES_PASS;
}
