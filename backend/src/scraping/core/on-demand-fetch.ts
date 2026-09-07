import { searchOtaku, getSpecificEpisodeLink } from '../../modules/otaku/otaku.service';
import { getFrenchStreamMovie, getFrenchStreamEpisode } from '../../modules/frenchstream/frenchstream.service';
import { connectDB } from '../../config/db';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { autoLink } from '../maintenance/auto-link';

/**
 * Recherche et récupère les informations pour un film ou une série s'il est manquant via direct API
 */
export async function fetchMissingMedia(
    title: string,
    type: 'movie' | 'series',
    episodeNum?: string,
    seasonNum?: string
) {
    console.log(`[OnDemand Direct API] Recherche de : "${title}" (${type}, S${seasonNum || 1}E${episodeNum || 1})...`);
    await connectDB();

    const targetSeason = seasonNum && parseInt(seasonNum, 10) > 0 ? parseInt(seasonNum, 10) : 1;
    const targetEpisode = episodeNum && parseInt(episodeNum, 10) > 0 ? parseInt(episodeNum, 10) : 1;

    if (type === 'series') {
        // 1. Tenter la recherche via Otaku avec season et episode
        let otakuRes = await searchOtaku(title, 'series', targetSeason, targetEpisode);
        let link = otakuRes?.lien;

        // 2. Fallback via FrenchStream
        if (!link) {
            const fsRes = await getFrenchStreamEpisode(title, targetSeason, targetEpisode);
            link = fsRes?.streamUrl;
        }

        // 3. Fallback spécifique
        if (!link) {
            link = await getSpecificEpisodeLink(null, String(targetEpisode), null, title) || undefined;
        }

        if (link) {
            const canonicalEp = `S${String(targetSeason).padStart(2, '0')}E${String(targetEpisode).padStart(2, '0')}`;
            const epData = {
                episode: canonicalEp,
                season: targetSeason,
                episodeNumber: targetEpisode,
                lien: link,
            };

            const existing = await Serie.findOne({ titre: title });
            let updated: any;

            if (existing) {
                const epIndex = existing.episodes?.findIndex(
                    (e: any) => Number(e.season) === targetSeason && Number(e.episodeNumber) === targetEpisode
                );

                if (epIndex !== undefined && epIndex >= 0) {
                    await Serie.updateOne(
                        { _id: existing._id, 'episodes.season': targetSeason, 'episodes.episodeNumber': targetEpisode },
                        { $set: { 'episodes.$.lien': link, 'episodes.$.episode': canonicalEp } }
                    );
                } else {
                    await Serie.updateOne(
                        { _id: existing._id },
                        { $push: { episodes: epData } }
                    );
                }
                updated = existing;
            } else {
                updated = await Serie.create({
                    titre: title,
                    pageUrl: '',
                    episodes: [epData]
                });
            }

            if (updated?._id) autoLink('series', updated._id.toString());
            return { titre: title, episode: canonicalEp, season: targetSeason, episodeNumber: targetEpisode, lien: link };
        }
    } else {
        // 1. Tenter Otaku
        let result = await searchOtaku(title, 'movie');
        let link = result?.lien;

        // 2. Fallback FrenchStream
        if (!link) {
            const fsRes = await getFrenchStreamMovie(title);
            link = fsRes?.streamUrl;
        }

        if (link) {
            const updated = await Movie.findOneAndUpdate(
                { titre: title },
                { $set: { titre: title, lien: link } },
                { upsert: true, returnDocument: 'after' }
            );
            if (updated?._id) autoLink('movie', updated._id.toString());
            return { titre: title, lien: link };
        }
    }

    return null;
}

if (process.argv[1] && process.argv[1].includes('on-demand-fetch')) {
    const title = process.argv[2];
    const type = process.argv[3] as 'movie' | 'series';
    const episodeNum = process.argv[4];
    const seasonNum = process.argv[5];

    if (title && type) {
        fetchMissingMedia(title, type, episodeNum, seasonNum)
            .then((result) => {
                if (result) {
                    console.log(`[OnDemand] Successfully fetched: ${JSON.stringify(result)}`);
                    process.exit(0);
                } else {
                    console.log(`[OnDemand] Failed to fetch missing media for: "${title}"`);
                    process.exit(1);
                }
            })
            .catch((err) => {
                console.error(`[OnDemand] Error executing fetch:`, err);
                process.exit(1);
            });
    } else {
        console.error('Usage: npx tsx on-demand-fetch.ts <title> <type> [episodeNum] [seasonNum]');
        process.exit(1);
    }
}
